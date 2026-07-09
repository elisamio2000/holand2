import type { LlmEndpoint, LlmModel } from '@/types/pipeline-admin.types';
import { pipelineAdminService } from '@/services/pipeline-admin.service';

type EndpointRef = Pick<LlmEndpoint, 'id' | 'name'>;

/** Models linked to an external endpoint (same rules as hydrate-from-api). */
export function modelsImportedFromEndpoint(
  endpoint: EndpointRef,
  models: LlmModel[]
): LlmModel[] {
  return models.filter((model) => {
    if (model.backend_kind !== 'external') return false;
    const meta = pipelineAdminService.parseModelMeta(model);
    const epId = String(meta?.endpoint_id ?? '');
    return (
      epId === endpoint.id ||
      model.endpoint_name === endpoint.name ||
      String(meta?.endpoint_name ?? '') === endpoint.name
    );
  });
}
