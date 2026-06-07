import { useCallback, useState } from "react";
import type { AppConfig } from "../../core/types";

interface ExternalLinkConfirmationRequest {
  url: string;
  resolve: (confirmed: boolean) => void;
}

export function useExternalLinkConfirmation(config: AppConfig | null) {
  const [externalLinkConfirmation, setExternalLinkConfirmation] =
    useState<ExternalLinkConfirmationRequest | null>(null);

  const confirmExternalLink = useCallback(
    (url: string): Promise<boolean> => {
      if (config?.security.confirmExternalLinks === false) {
        return Promise.resolve(true);
      }
      return new Promise((resolve) => {
        setExternalLinkConfirmation((current) => {
          current?.resolve(false);
          return { url, resolve };
        });
      });
    },
    [config?.security.confirmExternalLinks],
  );

  const resolveExternalLinkConfirmation = useCallback((confirmed: boolean) => {
    setExternalLinkConfirmation((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  return {
    confirmExternalLink,
    externalLinkConfirmation,
    resolveExternalLinkConfirmation,
  };
}
