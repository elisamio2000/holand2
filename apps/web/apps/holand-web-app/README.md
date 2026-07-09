## Holand Web Template Base with Internationalization support

**Run the following commands from the packages root**

First install the dependencies by running the following command.

```bash
pnpm install
```

Now to start the local development server run

```bash
pnpm web:dev
```

For project setup and architecture, follow the repository docs in `docs/` and `README.md`.

## Error Handling (Gateway tool execute)

The AI Platform gateway may return **HTTP 200** with an error payload when upstream tool-runner fails (BE-CRIT-2). Service-layer plugin calls use `assertGatewayToolSuccess()` to detect this and throw `GatewayToolError`.

```typescript
import { assertGatewayToolSuccess } from '@/utils/gateway-tool-success';

const res = await gatewayClient.post('/tools/plugin_file_manager_list/execute', body);
assertGatewayToolSuccess(res); // throws GatewayToolError if data.error or status_code >= 400
```

Errors are classified via `classifyApiError()` in `@/lib/api-errors` for consistent UI toasts.

See [CHANGELOG.md](./CHANGELOG.md).

