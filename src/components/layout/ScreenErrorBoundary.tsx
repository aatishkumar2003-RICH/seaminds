import React from "react";

interface Props {
  children: React.ReactNode;
  screenName: string;
}

interface State {
  hasError: boolean;
}

class ScreenErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error("Screen error in", this.props.screenName, ":", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-10 text-center text-primary">
          <div className="mb-4 text-[40px]">⚠️</div>
          <div className="mb-2 text-base text-foreground">Could not load {this.props.screenName}</div>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-3 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ScreenErrorBoundary;
