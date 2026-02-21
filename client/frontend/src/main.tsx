import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia } from "viem/chains";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EmbeddedWalletProvider } from "./contexts/EmbeddedWalletContext";
import App from "./App";
import "./app.css";

const config = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(),
  },
});

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <EmbeddedWalletProvider>
          <App />
        </EmbeddedWalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
