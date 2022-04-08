export default {
  id: 'aura-testnet', // DEPRECATE, only used for Lunie extension, NOT CHAIN ID
  name: 'Aura',
  description:
    'Cosmos is a network of independent parallel blockchains, powered by BFT consensus algorithms like Tendermint.',
  logo: `logo.svg`,
  website: 'https://aura.network',
  apiURL: 'http://34.199.79.132:1317', // use `npx lcp --proxyUrl http://34.123.30.100:1317`
  rpcURL: 'http://34.199.79.132:26657',
  stakingDenom: 'AURA',
  coinLookup: [
    {
      viewDenom: 'AURA',
      chainDenom: 'uaura',
      chainToViewConversionFactor: 1e-6,
      icon: `currencies/muon.png`,
    },
  ],
  addressPrefix: 'aura',
  validatorAddressPrefix: 'auravaloper',
  validatorConsensusaddressPrefix: 'auravalcons', // needed to map validators from staking queries to the validator set
  HDPath: `m/44'/118'/0'/0/0`,
  lockUpPeriod: `3 days`,
  fees: {
    default: {
      gasEstimate: 80000,
      feeOptions: [
        {
          denom: 'AURA',
          amount: 0.001,
        },
      ],
    },
  },
  icon: `https://lunie.fra1.digitaloceanspaces.com/network-icons/cosmos.png`,

  // This is only to be used as a developer tool and for testing purposes
  // NEVER ENABLE LOCALSIGNING IN PRODUCTION OR FOR MAINNETS
  localSigning: false,
}
