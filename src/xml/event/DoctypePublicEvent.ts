import type { DoctypeSAXEventPublicInterface } from "../event-interface/index.js";
import { DoctypeBaseEvent } from "./DoctypeBaseEvent.js";

export class DoctypePublicEvent extends DoctypeBaseEvent implements DoctypeSAXEventPublicInterface {
  dtdType: "PUBLIC";
  uri?: string;
  identifer: string;
  constructor(root: string, options: {
    dtdType: "PUBLIC"
    uri?: string
    identifer: string
  } & ConstructorParameters<typeof DoctypeBaseEvent>[1]) {
    super(root, options);
    this.dtdType = options.dtdType;
    this.uri = options.uri;
    this.identifer = options.identifer;
  }
}
