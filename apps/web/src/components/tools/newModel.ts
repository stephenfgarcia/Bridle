// The model "New model" starts (card PX-02.4): nothing drawn, and the one section, the one material and the
// one load case every fixture of @bridle/model has, so that the Member tool has a section and a material to
// give a member (`addMember` refuses without them).
import { emptyModel, type Model, portalFrame } from "@bridle/model";

/** The tag of the model store's `source` for a model started with "New model". */
export const NEW_MODEL_SOURCE = "new";

/** A new object on every call: no node, no member, no support, no load. */
export function newModel(): Model {
  const fixture = portalFrame();
  return {
    ...emptyModel(),
    sections: fixture.sections,
    materials: fixture.materials,
    loadCases: fixture.loadCases,
  };
}
