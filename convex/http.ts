import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Exposes /.well-known/openid-configuration and JWKS for token verification.
auth.addHttpRoutes(http);

export default http;
