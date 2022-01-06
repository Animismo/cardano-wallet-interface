const Buffer = require("buffer");
const Loader = require("./WasmLoader")
const StringFormatError = require("../errors/WalletInterfaceError/StringFormatError/StringFormatError");
const WalletInterfaceError = require("../errors/WalletInterfaceError/WalletInterfaceError");
const NamiError = require("../errors/WalletInterfaceError/WalletProcessError/WalletError/NamiError/NamiError");
const CCValutError = require("../errors/WalletInterfaceError/WalletProcessError/WalletError/CCValutError/CCValutError");
const WalletError = require("../errors/WalletInterfaceError/WalletProcessError/WalletError/WalletError");
const WalletProcessError = require("../errors/WalletInterfaceError/WalletProcessError/WalletProcessError");

private_walletInterface_hasBlockFrost = false;

class Wallet
{
  /**
   * @private
   */
  static _api_key = undefined;

  /**
   * @private
   */
  static _protocolParameters = undefined;

  /**
   * @private
   */
  static _namiObj = undefined;

  /**
   * @private
   */
  static _NamiInterface = undefined;

  
  /**
   * @private
   */
  static _ccvalutObj = undefined;
  
  /**
   * @private
   */
  static _CCValutInterface = undefined;

  /**
   * 
   * @param {string} blockfrost_project_id blockforst api key to be used
   */
  static setBlockforst( blockfrost_project_id )
  {    
    if( typeof blockfrost_project_id !== "string" ) throw StringFormatError("blockfrost_project_id must be a string")
    
    Wallet._api_key = blockfrost_project_id;
    
    private_walletInterface_hasBlockFrost = true;
  }
  
  static async makeBlockfrostRequest( endpoint, headers, body )
  {
    if( !private_walletInterface_hasBlockFrost ) throw new WalletProcessError("Wallet.setBlockforst has not been called, can't use Wallet.makeBlockfrostRequest")
    return await private_blockfrostRequest( Wallet._api_key, endpoint, headers, body );
  }

  static hasProtocolParameters()
  {
    return ( Wallet._protocolParameters !== undefined );
  }

  static async getProtocolParameters()
  {
    if( !Wallet.hasProtocolParameters() )
    {
      if( !private_walletInterface_hasBlockFrost ) throw new WalletProcessError("Wallet.setBlockforst has not been called, can't use Wallet.getProtocolParameters")

      Wallet._protocolParameters = await private_getProtocolParameters( Wallet._api_key );
    }

    return Wallet._protocolParameters;
  }

  static get protocolParameters()
  {
    if( !Wallet.hasProtocolParameters() ) throw new WalletError("protocoloParameters never checked before, call the async version Wallet.getProtocolParameters first");
    
    return Wallet._protocolParameters;
  }


  // ---------------------------------------- Nami ---------------------------------------- //

  /**
   * 
   * @returns {boolean} true if the nami extension has injected the window.cardano.enable function; false otherwise
   */
  static hasNami()
  {
    if( typeof window === "undefined" ) throw new WalletInterfaceError("can check for nami extension on in a browser environment");

    // if only ccvalut was installed but not nami
    // then window.cardano would still be defined but containing onli the ccvalut object
    // here I check for window.cardano.enable to be defined but could be any function defined
    // by the nami extension
    return ( typeof window.cardano?.enable !== "undefined" );
  }

  static async enableNami()
  {
    if( !Wallet.hasNami() ) throw new NamiError("can't access the Nami object if the nami extension is not installed");

    if( await window.cardano.isEnabled() || await window.cardano.enable() )
      Wallet._namiObj = window.cardano;
    else
      Wallet._namiObj = undefined;
  }

  static get namiHasBeenEnabled()
  {
    return ( Wallet._namiObj !== undefined )
  }

  static get Nami()
  {
    if( !Wallet.hasNami() ) throw new NamiError("can't access the Nami object if the nami extension is not installed");
    if( !Wallet.namiHasBeenEnabled ) throw NamiError("Wallet.enableNami has never been called before, can't access the Nami interface");

    if( Wallet._NamiInterface === undefined )
    {
      Wallet._NamiInterface = private_makeWalletInterface( Wallet._namiObj, Wallet._api_key )
    }

    return Wallet._NamiInterface;
  }
  
  // ---------------------------------------- CCValut ---------------------------------------- //
  /**
   * 
   * @returns {boolean} true if the ccvalut extension has injected the window.cardano.ccvalut object; false otherwise
   */
  static hasCCValut()
  {
    if( typeof window === "undefined" ) throw new WalletInterfaceError("can check for ccvalut extension on in a browser environment");

    return !!window.cardano?.ccvalut;
  }

  static async enableCCValut()
  {
    if( !Wallet.hasCCValut() ) throw new CCValutError("can't access the CCValut object if the ccvalut extension is not installed");

    try
    {
      Window._ccvalutObj = await window.cardano.ccvalut.enable();
    }
    catch (e)
    {
      console.warn("could not enable ccvalut");
      Wallet._ccvalutObj = undefined;
      throw e;
    }
  }

  static get ccvalutHasBeenEnabled()
  {
    return ( Wallet._ccvalutObj !== undefined )
  }

  static get CCValut()
  {
    if( !Wallet.hasCCValut() ) throw new CCValutError("can't access the CCValut object if the ccvalut extension is not installed");
    if( !Wallet.ccvalutHasBeenEnabled ) throw new CCValutError("Wallet.enableCCValut has never been called before, can't access the CCValut interface");

    if( Wallet._CCValutInterface === undefined )
    {
      Wallet._CCValutInterface = private_makeWalletInterface( Wallet._ccvalutObj, Wallet._api_key )
    }

    return Wallet._CCValutInterface;
  }

}

function private_makeWalletInterface( WalletProvider, defaultBlockfrost_api_key )
{
  const getCurrentUserDelegation = async ( blockfrost_project_id = undefined ) =>
  {
    if( !(blockfrost_project_id || defaultBlockfrost_api_key) ) throw NamiError("no blockfrost api key was provvided, please set a default one by calling Wallet.setBlockfrost or pass one as a parameter");

    if( typeof blockfrost_project_id !== "string" )
    {
      if( typeof defaultBlockfrost_api_key !== "string" ) throw NamiError("no blockfrost api key is valid");

      return await private_getCurrentUserDelegation( WalletProvider, defaultBlockfrost_api_key )
    }
    else
    {
      return await private_getCurrentUserDelegation( WalletProvider, blockfrost_project_id )
    }
  }

  const createDelegagtionTransaction = async ( targetPoolId, blockfrost_project_id = undefined ) => {
    if( typeof targetPoolId !== "string" ) throw StringFormatError("in order to delegate to a pool you must provvide a valid pool id string;  pool id was: " + targetPoolId );
    if( !targetPoolId.startsWith("pool") ) throw StringFormatError("you must use the bech 32 pool id, perhaps you provvided the hex pool id? input was: " + targetPoolId );

    return await private_delegationTransaction(
      blockfrost_project_id,
      WalletProvider,
      await getCurrentUserDelegation( blockfrost_project_id ),
      targetPoolId
    )
  };

  const signTransaction = async ( transactionToSign ) =>
  {
    return await private_signTransaction( WalletProvider, transactionToSign );
  }

  const submitTransaction = async ( signedTransaction ) =>
  {
    return await private_submitTransaction( WalletProvider, signedTransaction )
  }

  const delegateTo= async ( targetPoolId, blockfrost_project_id = undefined ) => 
  {
    return await submitTransaction(
      await signTransaction(
        await createDelegagtionTransaction(
          targetPoolId,
          blockfrost_project_id
        )
      )
    )
  }

  return {
    ...WalletProvider,
    getCurrentUserDelegation,
    createDelegagtionTransaction,
    signTransaction,
    submitTransaction,
    getPoolId: private_getPoolId,
    delegateTo
  }
}

async function private_blockfrostRequest( blockfrost_project_id, endpoint, headers, body )
{
  if( typeof blockfrost_project_id !== "string" ) throw Error;

  return await fetch(
    `https://cardano-mainnet.blockfrost.io/api/v0` + endpoint,
    {
      headers: { project_id: blockfrost_project_id },
    }
  ).then((res) => res.json());
};


async function private_getProtocolParameters( blockfrost_project_id )
{
  if( typeof blockfrost_project_id !== "string" ) throw Error;

  await Loader.load();

  const p = await private_blockfrostRequest( blockfrost_project_id,"/epochs/latest/parameters" );

  return {
    linearFee: Loader.Cardano.LinearFee.new(
      Loader.Cardano.BigNum.from_str(p.min_fee_a.toString()),
      Loader.Cardano.BigNum.from_str(p.min_fee_b.toString())
    ),
    minUtxo: Loader.Cardano.BigNum.from_str(p.min_utxo),
    poolDeposit: Loader.Cardano.BigNum.from_str(p.pool_deposit),
    keyDeposit: Loader.Cardano.BigNum.from_str(p.key_deposit),
    maxValueSize: p.max_val_size,
    maxTxSize: p.max_tx_size,
  };
};


function private_getPoolId( bech32_poolId )
{
  return Buffer.from(Loader.Cardano.Ed25519KeyHash.from_bech32(poolId).to_bytes(), "hex").toString("hex")
}


async function private_delegationTransaction( blockfrost_project_id, WalletProvider, delegation, targetPoolId)
{
  await Loader.load();
  const protocolParameters = await private_getProtocolParameters( blockfrost_project_id );

  let address = (await WalletProvider.getUsedAddresses())[0];
  address = Loader.Cardano.Address.from_bytes(Buffer.from(address, "hex"));

  const getRewardAddress =
  // nami
  WalletProvider.getRewardAddress || 
  // ccvalut
  (async () => { return await WalletProvider.getRewardAddresses()[0] });

  if( typeof getRewardAddress === "undefined" )
  throw WalletProcessError(
  "could not find reward address or addresses, probably this is not your fault and the package may need mainatainance, please open an issue"
  );

  const rewardAddress = await getRewardAddress();

  const stakeCredential = Loader.Cardano.RewardAddress.from_address(
    Loader.Cardano.Address.from_bytes(Buffer.from(rewardAddress, "hex"))
  ).payment_cred();

  let utxos = await WalletProvider.getUtxos();

  utxos = utxos.map((utxo) =>
    Loader.Cardano.TransactionUnspentOutput.from_bytes(Buffer.from(utxo, "hex"))
  );

  //estimated max multiasset size 5848
  //estimated max value size 5860
  //estimated max utxo size 5980
  const MULTIASSET_SIZE = 5848;
  const VALUE_SIZE = 5860;

  const outputs = Loader.Cardano.TransactionOutputs.new();
  outputs.add(
    Loader.Cardano.TransactionOutput.new(
      address,
      Loader.Cardano.Value.new(protocolParameters.keyDeposit)
    )
  );

  const selection = await CoinSelection.randomImprove(
    utxos,
    outputs,
    20,
    protocolParameters.minUtxo.to_str()
  );

  const inputs = selection.input;

  const txBuilder = Loader.Cardano.TransactionBuilder.new(
    protocolParameters.linearFee,
    protocolParameters.minUtxo,
    protocolParameters.poolDeposit,
    protocolParameters.keyDeposit,
    protocolParameters.maxValueSize,
    protocolParameters.maxTxSize
  );

  for (let i = 0; i < inputs.length; i++) {
    const utxo = inputs[i];
    txBuilder.add_input(
      utxo.output().address(),
      utxo.input(),
      utxo.output().amount()
    );
  }

  const certificates = Loader.Cardano.Certificates.new();
  if (!delegation.active)
    certificates.add(
      Loader.Cardano.Certificate.new_stake_registration(
        Loader.Cardano.StakeRegistration.new(stakeCredential)
      )
    );

  certificates.add(
    Loader.Cardano.Certificate.new_stake_delegation(
      Loader.Cardano.StakeDelegation.new(
        stakeCredential,
        Loader.Cardano.Ed25519KeyHash.from_bech32(targetPoolId)
      )
    )
  );
  txBuilder.set_certs(certificates);

  const change = selection.change;
  const changeMultiAssets = change.multiasset();

  // check if change value is too big for single output
  if (changeMultiAssets && change.to_bytes().length * 2 > VALUE_SIZE) {
    const partialChange = Loader.Cardano.Value.new(
      Loader.Cardano.BigNum.from_str("0")
    );

    const partialMultiAssets = Loader.Cardano.MultiAsset.new();
    const policies = changeMultiAssets.keys();
    const makeSplit = () => {
      for (let j = 0; j < changeMultiAssets.len(); j++) {
        const policy = policies.get(j);
        const policyAssets = changeMultiAssets.get(policy);
        const assetNames = policyAssets.keys();
        const assets = Loader.Cardano.Assets.new();
        for (let k = 0; k < assetNames.len(); k++) {
          const policyAsset = assetNames.get(k);
          const quantity = policyAssets.get(policyAsset);
          assets.insert(policyAsset, quantity);
          //check size
          const checkMultiAssets = Loader.Cardano.MultiAsset.from_bytes(
            partialMultiAssets.to_bytes()
          );
          checkMultiAssets.insert(policy, assets);
          if (checkMultiAssets.to_bytes().length * 2 >= MULTIASSET_SIZE) {
            partialMultiAssets.insert(policy, assets);
            return;
          }
        }
        partialMultiAssets.insert(policy, assets);
      }
    };
    makeSplit();
    partialChange.set_multiasset(partialMultiAssets);
    const minAda = Loader.Cardano.min_ada_required(
      partialChange,
      protocolParameters.minUtxo
    );
    partialChange.set_coin(minAda);

    txBuilder.add_output(
      Loader.Cardano.TransactionOutput.new(address, partialChange)
    );
  }

  txBuilder.add_change_if_needed(address);

  const transaction = Loader.Cardano.Transaction.new(
    txBuilder.build(),
    Loader.Cardano.TransactionWitnessSet.new()
  );

  const size = transaction.to_bytes().length * 2;
  if (size > protocolParameters.maxTxSize) throw ERROR.txTooBig;

  return transaction;
};

async function private_signTransaction( WalletProvider, transactionObj )
{
  await Loader.load();

  const witnesses = await WalletProvider.signTx(
    Buffer.from(transactionObj.to_bytes(), "hex").toString("hex")
  );

  const signedTx = await Loader.Cardano.Transaction.new(
    transactionObj.body(),
    Loader.Cardano.transactionObj.from_bytes(
      Buffer.from(witnesses, "hex")
    )
  );

  return signedTx;
};

async function private_submitTransaction( WalletProvider, signedTransaction )
{
  const txHash = await WalletProvider.submitTx(
    Buffer.from( signedTransaction.to_bytes(), "hex").toString("hex")
  );

  return txHash;
};

async function private_getCurrentUserDelegation( WalletProvider, blockfrost_project_id ){
  await Loader.load();

  const getRewardAddress =
  // nami
  WalletProvider.getRewardAddress || 
  // ccvalut
  (async () => { return await WalletProvider.getRewardAddresses()[0] });

  if( typeof getRewardAddress === "undefined" )
  throw WalletProcessError(
  "could not find reward address or addresses, probably this is not your fault and the package may need mainatainance, please open an issue"
  );

  const rawAddress = await getRewardAddress();
  const rewardAddress = Loader.Cardano.Address.from_bytes(
    Buffer.from(rawAddress, "hex")
  ).to_bech32();

  const stake = await private_blockfrostRequest( blockfrost_project_id, `/accounts/${rewardAddress}`);

  if (!stake || stake.error || !stake.pool_id) return {};

  return stake;
};

module.exports = Wallet;