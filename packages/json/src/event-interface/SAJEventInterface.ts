import type { EndArraySAJEventInterface } from "./EndArraySAJEventInterface.js";
import type { EndObjectSAJEventInterface } from "./EndObjectSAJEventInterface.js";
import type { KeySAJEventInterface } from "./KeySAJEventInterface.js";
import type { StartArraySAJEventInterface } from "./StartArraySAJEventInterface.js";
import type { StartObjectSAJEventInterface } from "./StartObjectSAJEventInterface.js";
import type { ValueBooleanSAJEventInterface } from "./ValueBooleanSAJEventInterface.js";
import type { ValueNullSAJEventInterface } from "./ValueNullSAJEventInterface.js";
import type { ValueNumberSAJEventInterface } from "./ValueNumberSAJEventInterface.js";
import type { ValueStringSAJEventInterface } from "./ValueStringSAJEventInterface.js";
import type { StartDocumentSAJEventInterface } from "./StartDocumentSAJEventInterface.js";
import type { EndDocumentSAJEventInterface } from "./EndDocumentSAJEventInterface.js";
import type { ErrorSAJEventInterface } from "./ErrorSAJEventInterface.js";

export type SAJEventInterface
  = StartArraySAJEventInterface
    | EndArraySAJEventInterface
    | StartObjectSAJEventInterface
    | EndObjectSAJEventInterface
    | KeySAJEventInterface
    | ValueBooleanSAJEventInterface
    | ValueNullSAJEventInterface
    | ValueNumberSAJEventInterface
    | ValueStringSAJEventInterface
    | StartDocumentSAJEventInterface
    | EndDocumentSAJEventInterface
    | ErrorSAJEventInterface;
