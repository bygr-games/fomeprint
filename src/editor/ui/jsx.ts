import texsaurJsx from "texsaur";

type JsxProps = Record<string, unknown>;

export default function jsx(
  tag: unknown,
  props?: JsxProps | null,
  ...children: unknown[]
) {
  if (props && typeof tag === "string") {
    // Vite dev JSX can inject these debug fields; strip them for DOM tags.
    const { __source: _source, __self: _self, ...safeProps } = props;
    return texsaurJsx(tag, safeProps as JsxProps, ...children);
  }

  return texsaurJsx(tag, props ?? undefined, ...children);
}

jsx.Fragment = texsaurJsx.Fragment;
