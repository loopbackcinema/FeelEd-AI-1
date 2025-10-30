import { useState, useEffect, useCallback } from 'react';

export const useApiKey = (userRole: string) => {
  const [isApiKeyReady, setIsApiKeyReady] = useState<boolean>(false);
  const [isKeyCheckInProgress, setIsKeyCheckInProgress] = useState<boolean>(true);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);

  const checkApiKey = useCallback(async () => {
    setIsKeyCheckInProgress(true);
    setApiKeyError(null);

    if (typeof window.aistudio === 'undefined') {
      setIsApiKeyReady(true);
      setIsKeyCheckInProgress(false);
      return;
    }

    try {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setIsApiKeyReady(hasKey);
      if (!hasKey && userRole !== 'Student') {
        setShowApiKeyModal(true);
      }
    } catch (e) {
      console.error("Error checking for API key:", e);
      setApiKeyError("An error occurred while checking your API key status.");
      if (userRole !== 'Student') {
        setShowApiKeyModal(true);
      }
    } finally {
      setIsKeyCheckInProgress(false);
    }
  }, [userRole]);

  useEffect(() => {
    checkApiKey();
  }, [checkApiKey]);

  const handleSelectKey = useCallback(async () => {
    if (window.aistudio) {
      setApiKeyError(null);
      try {
        await window.aistudio.openSelectKey();
        setIsApiKeyReady(true);
        setShowApiKeyModal(false); // Close modal on success
        return true; // Indicate success
      } catch (e) {
        console.error("Error or dismissal during API key selection:", e);
        return false; // Indicate failure/dismissal
      }
    } else {
      console.error("handleSelectKey called without aistudio environment.");
      setApiKeyError("Cannot open API key selector: AI Studio environment not found.");
      return false;
    }
  }, []);

  return {
    isApiKeyReady,
    isKeyCheckInProgress,
    apiKeyError,
    showApiKeyModal,
    handleSelectKey,
    checkApiKey,
    setApiKeyError,
  };
};
