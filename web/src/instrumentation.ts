export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import the logger to trigger console interception and global error handlers
    await import('./lib/logger');
  }
}

type RequestErrorRequest = {
  path?: string;
  method?: string;
};

type RequestErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
  revalidateReason?: string;
};

export async function onRequestError(
  err: unknown,
  request: RequestErrorRequest,
  context: RequestErrorContext
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { captureServerException } = await import('./lib/observability/server');
  captureServerException(err, {
    operation_kind: 'next_request',
    operation_name: context.routePath ?? request.path ?? 'unknown',
    method: request.method,
    router_kind: context.routerKind,
    route_type: context.routeType,
    render_source: context.renderSource,
    revalidate_reason: context.revalidateReason,
  });
}
