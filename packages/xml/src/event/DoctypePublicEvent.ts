import type { DoctypeSAXEventPublicInterface } from "../event-interface/index.js";
import { DoctypeBaseEvent } from "./DoctypeBaseEvent.js";

export class DoctypePublicEvent extends DoctypeBaseEvent implements DoctypeSAXEventPublicInterface {
  dtdType: "PUBLIC";
  uri?: string;
  identifier: string;
  constructor(root: string, options: {
    dtdType: "PUBLIC"
    uri?: string
    identifier: string
  } & ConstructorParameters<typeof DoctypeBaseEvent>[1]) {
    super(root, options);
    this.dtdType = options.dtdType;
    this.uri = options.uri;
    this.identifier = options.identifier;
  }
}
