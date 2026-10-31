'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { captureClientException } from '@/lib/observability/client';

type Props = {
  children: ReactNode;
  mapType: string;
  warId?: string;
  battlegroup?: number;
};

/** Recover the map without unmounting fight editors or other planner state. */
export class MapErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureClientException(error, {
      source: 'war_map_render',
      component_stack: info.componentStack,
      map_type: this.props.mapType,
      war_id: this.props.warId,
      battlegroup: this.props.battlegroup,
    });
  }

  componentDidUpdate(previous: Props) {
    const changedMap = previous.mapType !== this.props.mapType ||
      previous.warId !== this.props.warId || previous.battlegroup !== this.props.battlegroup;
    if (this.state.failed && changedMap) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex h-full min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-medium text-slate-200">The map couldn’t be drawn.</p>
        <p className="text-sm text-slate-400">Your assignments are still available in the planner.</p>
        <Button variant="outline" onClick={() => this.setState({ failed: false })}>Reload map</Button>
      </div>
    );
  }
}
