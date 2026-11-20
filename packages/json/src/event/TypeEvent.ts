import type { TypeSAJEventInterface } from "../event-interface/index.js";
import { SAJEvent } from "./SAJEvent.js";

type ValueType = "number" | "string" | "null" | "array" | "object" | "boolean";
/**
 * Base class for typed SAJ events.
 */
export class TypeEvent<N extends string, VT extends ValueType> extends SAJEvent<N> implements TypeSAJEventInterface<VT> {
  type: VT;
  constructor(name: N, type: VT) {
    super(name);
    this.type = type;
  }
}
