import type { DoctypeSAXEventSystemInterface } from "../event-interface/index.js";
import { DoctypeBaseEvent } from "./DoctypeBaseEvent.js";

/**
 * Event class representing an XML `<!DOCTYPE root SYSTEM "...">` declaration.
 */
export class DoctypeSystemEvent extends DoctypeBaseEvent implements DoctypeSAXEventSystemInterface {
  dtdType: "SYSTEM";
  uri: string;
  constructor(root: string, options: {
    dtdType: "SYSTEM"
    uri: string
  } & ConstructorParameters<typeof DoctypeBaseEvent>[1]) {
    super(root, options);
    this.dtdType = options.dtdType;
    this.uri = options.uri;
  }
}
