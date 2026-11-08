import { Component, type ReactNode } from "react";

export class PageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="module-loading" role="alert">
          <strong>No pudimos abrir este módulo.</strong>
          <p>Los demás módulos siguen disponibles.</p>
          <button
            className="button-secondary"
            onClick={() => this.setState({ failed: false })}
          >
            Volver a intentar
          </button>
        </div>
      );
    return this.props.children;
  }
}
