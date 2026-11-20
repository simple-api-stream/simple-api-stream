import type { DoctypeSAXEventSimpleInterface } from "../event-interface/index.js";
import { DoctypeBaseEvent } from "./DoctypeBaseEvent.js";

/**
 * Event class representing a simple XML `<!DOCTYPE root>` declaration without an external DTD identifier.
 */
export class DoctypeSimpleEvent extends DoctypeBaseEvent implements DoctypeSAXEventSimpleInterface {
  dtdType?: undefined = undefined;
  constructor(root: string, options?: {
    dtdType?: undefined
  } & ConstructorParameters<typeof DoctypeBaseEvent>[1]) {
    super(root, options);
    this.dtdType = options?.dtdType;
  }
}
