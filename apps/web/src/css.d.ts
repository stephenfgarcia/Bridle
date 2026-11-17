// A plain stylesheet imported for its side effect (`import "./global.css"`). TypeScript checks side-effect
// imports, and Next's own types declare only the `*.module.css` form.
declare module "*.css";
