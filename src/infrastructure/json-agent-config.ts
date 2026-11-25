import {
  applyEdits,
  findNodeAtLocation,
  getNodeValue,
  modify,
  parseTree,
  type ParseError,
} from 'jsonc-parser';
import { WorkError } from '../domain/work.js';

export function editServerConfig(
  original: string,
  path: string[],
  entry: unknown | undefined,
  owned: (value: unknown) => boolean,
): string {
  const source = original || '{}';
  const errors: ParseError[] = [];
  const tree = parseTree(source, errors, { allowTrailingComma: true });
  if (errors.length || !tree || tree.type !== 'object')
    throw new WorkError('Invalid MCP configuration. Correct the file before enabling WID.');
  for (let length = 1; length < path.length; length++) {
    const parent = findNodeAtLocation(tree, path.slice(0, length));
    if (parent && parent.type !== 'object')
      throw new WorkError('Invalid MCP configuration: the servers section must be an object.');
  }
  if (path[0] === 'mcp' && path[1] === 'servers') {
    const root = findNodeAtLocation(tree, ['mcp']);
    const values = root ? getNodeValue(root) : {};
    if (
      Object.entries(values).some(
        ([key, value]) =>
          key !== 'servers' && value && typeof value === 'object' && 'type' in value,
      )
    )
      throw new WorkError(
        'This adapter requires OpenCode 2. Preserve or migrate the legacy MCP configuration before enabling WID.',
        409,
      );
  }
  const node = findNodeAtLocation(tree, path);
  if (node && !owned(getNodeValue(node)))
    throw new WorkError('A wid entry from another installation already exists.', 409);
  if (!node && entry === undefined) return original;
  return applyEdits(
    source,
    modify(source, path, entry, {
      formattingOptions: {
        insertSpaces: true,
        tabSize: 2,
        eol: source.includes('\r\n') ? '\r\n' : '\n',
      },
    }),
  );
}
