import { useEffect, useState } from 'react';
import { On, Off, Heading, Button, Box, Stack } from './components';
import { loadConnectKit, SupportedProviders } from '@ledgerhq/connect-kit-loader';

export const shortenAddress = (address) => {
  if (!address) return "none";

  const match = address.match(
    /^(0x[a-zA-Z0-9]{2})[a-zA-Z0-9]+([a-zA-Z0-9]{2})$/
  );

  return match ? `${match[1]}...${match[2]}` : address;
};

export default function Home() {
  const [provider, setProvider] = useState();
  const [account, setAccount] = useState();
  const [chainId, setChainId] = useState();
  const [message, setMessage] = useState('');

  const connectWallet = async () => {
    console.log('> connectWallet');

    resetState();

    try {
      const connectKit = await loadConnectKit();
      connectKit.enableDebugLogs();
      const checkSupportResult = connectKit.checkSupport({
        chainId: 137,
        providerType: SupportedProviders.Ethereum,
        rpc: {
          1: 'https://cloudflare-eth.com/',  // Mainnet
          5: 'https://goerli.optimism.io/',  // Goerli
          137: 'https://polygon-rpc.com/',   // Polygon
        }
      });
      console.log('checkSupportResult is', checkSupportResult);

      const connectKitProvider = await connectKit.getProvider();
      setProvider(connectKitProvider);

      const requestAccountsResponse = await (requestAccounts(connectKitProvider));
      if (requestAccountsResponse) setAccount(requestAccountsResponse[0]);

      const chainIdResponse = await getChainId(connectKitProvider);
      if (chainIdResponse) setChainId(chainIdResponse);
    } catch (error) {
      console.error(error)
      setMessage(error);
    }
  };

  const disconnectWallet = async () => {
    console.log('> disconnectWallet');

    if (provider.disconnect) {
      console.log('> calling provider.disconnect()');
      provider.disconnect();
    }

    // needs to be called here
    // the Extension does not emit a disconnect event
    resetState();
  }

  const resetState = async () => {
    console.log('> resetState');

    setAccount();
    setChainId();
    setProvider();
    setMessage('');
  };

  const requestAccounts = async (provider) => {
    try {
      return await provider.request({ method: 'eth_requestAccounts' });
    } catch (error) {
      console.error(error)
      setMessage(error);
    }
  }

  const getChainId = async (provider) => {
    try {
      return await provider.request({ method: 'eth_chainId' });
    } catch (error) {
      console.error(error)
      setMessage(error);
    }
  }

  const isRequestedChainId = (requestedChainId) => {
    console.log(`comparing ${requestedChainId} to ${chainId}`)
    return chainId === requestedChainId || chainId === `0x${requestedChainId.toString(16)}`;
  }

  const switchChains = async (chainId) => {
    setMessage('');

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error) {
      console.error(error)
      setMessage(error);
    }
  }

  useEffect(() => {
    console.log('> useEffect');

    if (provider?.on) {
      const handleDisconnect = (props) => {
        console.log('> handleDisconnect', props);

        // needs to be called here to handle disconnect from Ledger Live
        resetState();
      };

      const handleChainChanded = async (chainId) => {
        console.log('> handleChainChanded', chainId);
        setChainId(chainId);
      }

      const handleAccountsChanged = async (accounts) => {
        console.log('> handleAccountsChanged', accounts);
        setAccount(accounts[0]);
      }

      provider.on('chainChanged', handleChainChanded);
      provider.on('accountsChanged', handleAccountsChanged);
      provider.on("disconnect", handleDisconnect);

      return () => {
        // handle removing event listeners here,
        // when disconnecting from the Extension no disconnect event is emited
        if (provider.removeListener) {
          console.log('> removing event listeners');

          provider.removeListener('chainChanged', handleChainChanded);
          provider.removeListener('accountsChanged', handleAccountsChanged);
          provider.removeListener("disconnect", handleDisconnect);
        }
      };
    }
  }, [provider]);

  return (
    <>
      <Stack direction="column" justifyContent="center" height="100vh">
        <Heading>Connect with Ledger Connect Kit</Heading>

        <Box>Status: {account
          ? (<On>Connected</On>)
          : (<Off>Not connected</Off>)
        }</Box>

        {account && (
          <>
            <Box>{`Chain Id: ${chainId ? chainId : "none"}`}</Box>
            <Box>{`Account: ${shortenAddress(account)}`}</Box>
          </>
        )}

        <Box>{message ? message.message : null}</Box>

        {!account ? (
          <Box>
            <Button bg='primary' onClick={connectWallet}>Connect Wallet</Button>
          </Box>
        ) : (
          <>
            <Box>
              <Button onClick={disconnectWallet}>Disconnect</Button>
            </Box>

            <Box>
              <Button disabled={isRequestedChainId(137)} onClick={() => switchChains(137)}>Switch to Polygon</Button>
            </Box>
            <Box>
              <Button disabled={isRequestedChainId(5)} onClick={() => switchChains(5)}>Switch to Göerli</Button>
            </Box>
            <Box>
              <Button disabled={isRequestedChainId(1)} onClick={() => switchChains(1)}>Switch to Mainnet</Button>
            </Box>
            </>
        )}
      </Stack>
    </>
  );
}
