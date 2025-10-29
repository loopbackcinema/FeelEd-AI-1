import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  // FIX: Reverted to using a constructor for state initialization.
  // The previous implementation using a class property for state was causing 'this.props' to be undefined.
  // Using a constructor ensures the component's props are correctly handled.
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    // A simple way to let the user try again is to reload the page
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      // Use the error's name and message to provide more context
      const title = this.state.error && this.state.error.name !== 'Error' ? this.state.error.name : "An Unexpected Error Occurred";
      const message = this.state.error?.message || "An unknown issue occurred. Please try refreshing the page.";

      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 text-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl text-center p-8 bg-red-50 border border-red-200 rounded-xl animate-fade-in-up">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-red-800">{title}</h3>
                <p className="text-red-600 mt-2 max-w-md mx-auto">{message}</p>
                <button
                    onClick={this.handleReset}
                    className="mt-6 px-6 py-2 text-base font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                    Try Again
                </button>
            </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}

export default ErrorBoundary;