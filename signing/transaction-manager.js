import BigNumber from 'bignumber.js'
import { SigningStargateClient } from '@cosmjs/stargate'
import {
  makeAuthInfoBytes,
  makeSignDoc,
  encodePubkey,
  coins,
} from '@cosmjs/proto-signing'
import { toBase64 } from '@cosmjs/encoding'
// import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'
// import axios from 'axios'
import { getSigner } from './signer'
import messageCreators from './messages.js'
import fees from '~/common/fees'
import network from '~/common/network'
import { signWithExtension } from '~/common/extension-utils'

export function getFees(transactionType, feeDenom) {
  const { gasEstimate, feeOptions } = fees.getFees(transactionType)
  const fee = feeOptions.find(({ denom }) => denom === feeDenom)
  const coinLookup = network.getCoinLookup(fee.denom, 'viewDenom')
  // converting view fee to on chain fee
  const convertedFee = [
    {
      amount: BigNumber(fee.amount)
        .div(coinLookup.chainToViewConversionFactor)
        .toString(),
      denom: coinLookup.chainDenom,
    },
  ]
  return {
    gasEstimate: String(gasEstimate),
    fee: convertedFee,
  }
}

export async function createSignBroadcast({
  messageType,
  message,
  senderAddress,
  accountInfo,
  network,
  signingType,
  password,
  HDPath,
  feeDenom,
  chainId,
  memo,
  ledgerTransport,
}) {
  const feeData = getFees(messageType, feeDenom)
  const transactionData = {
    ...feeData,
    memo,
    chainId,
    accountNumber: accountInfo.accountNumber,
    accountSequence: accountInfo.sequence,
  }
  // console.log('account', accountInfo)
  let signedTx
  let broadcastResult
  if (signingType === 'extension') {
    signedTx = await signWithExtension(
      messageType,
      message,
      transactionData,
      senderAddress,
      network
    )
  } else {
    const signer = await getSigner(
      signingType,
      {
        address: senderAddress,
        password,
      },
      chainId,
      ledgerTransport
    )
    // console.log('signer', signer)
    const account = await signer.getAccounts()
    // console.log('account', account[0])
    const messages = messageCreators[messageType](
      senderAddress,
      message,
      network
    )

    const signDoc = makeSignDoc(
      [].concat(messages),
      {
        amount: transactionData.fee[0].amount,
        gas: transactionData.gasEstimate,
      },
      chainId,
      memo || '',
      accountInfo.accountNumber,
      accountInfo.sequence
    )

    const pubkey = encodePubkey({
      type: 'tendermint/PubKeySecp256k1',
      value: toBase64(account[0].pubkey),
    })
    const sequence = accountInfo.sequence
    const authInfoBytes = makeAuthInfoBytes(
      [{ pubkey, sequence }],
      transactionData.fee,
      transactionData.gasEstimate
    )
    // console.log('authInfoBytes', authInfoBytes)
    // const { signed, signature } = await signer.sign(senderAddress, signDoc)
    const client = await SigningStargateClient.connectWithSigner(
      network.rpcURL,
      signer
    )
    // console.log('client', client)
    // signedTx = makeStdTx(signed, signature)
    // console.log('signedTx', signed)
    // console.log('signature', signature)

    // success
    const messagesSend = messageCreators[messageType](
      senderAddress,
      message,
      network
    )

    const fee = {
      amount: coins(20, 'uaura'),
      gas: '200000',
    }
    broadcastResult = await client.signAndBroadcast(
      senderAddress,
      [messagesSend],
      fee
    )
    console.log('broadcastResult', broadcastResult)

    // const result = await client.signAndBroadcast(senderAddress, [messages], feeData )
    // console.log(result);
  }

  // const broadcastBody = {
  //   tx: signedTx,
  //   mode: 'sync', // if we use async we don't wait for checks on the tx to have passed so we don't get errors
  // }
  // const broadcastResult = await axios
  //   .post(`${network.apiURL}/txs`, broadcastBody)
  //   .then((res) => res.data)
  // const client = await StargateClient.connect(network.apiURL)
  // const result = await client.broadcastTx(signedTx)

  // console.log(result)

  assertIsBroadcastTxSuccess(broadcastResult)

  return {
    hash: broadcastResult.transactionHash,
  }
}

export function assertIsBroadcastTxSuccess(res) {
  if (!res) throw new Error(`Error sending transaction`)
  if (Array.isArray(res)) {
    if (res.length === 0) throw new Error(`Error sending transaction`)

    res.forEach(assertIsBroadcastTxSuccess)
  }

  if (res.error) {
    throw new Error(res.error)
  }

  // Sometimes we get back failed transactions, which shows only by them having a `code` property
  if (res.code) {
    const message = res.raw_log.message
      ? JSON.parse(res.raw_log).message
      : res.raw_log
    throw new Error(message)
  }

  if (!res.transactionHash) {
    const message = res.message
    throw new Error(message)
  }

  return res
}

export async function pollTxInclusion(txHash, iteration = 0) {
  const MAX_POLL_ITERATIONS = 30
  let txFound = false
  try {
    await fetch(`${network.apiURL}/txs/${txHash}`).then((res) => {
      if (res.status === 200) {
        txFound = true
      }
    })
  } catch (err) {
    // ignore error
  }
  if (txFound) {
    return true
  } else if (iteration < MAX_POLL_ITERATIONS) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    return pollTxInclusion(txHash, iteration + 1)
  } else {
    throw new Error(
      `The transaction wasn't included in time. Check explorers for the transaction hash ${txHash}.`
    )
  }
}
