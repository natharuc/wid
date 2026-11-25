import { ArrowUpRight, Link2 } from 'lucide-react';
import type { Task } from './api';

function destination(url: string) {
  const { hostname, protocol } = new URL(url);
  if (hostname === 'dev.azure.com' || hostname.endsWith('.visualstudio.com'))
    return 'Open in Azure DevOps';
  if (hostname === 'github.com') return 'Open in GitHub';
  if (hostname === 'slack.com' || hostname.endsWith('.slack.com')) return 'Open in Slack';
  return protocol === 'thread:' ? 'Open chat' : 'Open reference';
}
export function ReferenceLinks({ references }: { references: Task['references'] }) {
  return (
    <section className="card bg-base-100 border border-base-300">
      <div className="card-body p-5 gap-4">
        <h2 className="card-title text-base">
          <Link2 size={18} />
          References
        </h2>
        {references.length ? (
          references.map((ref) => (
            <div key={ref.url} className="min-w-0 space-y-1">
              <p className="font-medium text-sm break-words">{ref.label}</p>
              <a
                className="link link-primary inline-flex items-center gap-1 text-sm"
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${destination(ref.url)}: ${ref.label}`}
              >
                {destination(ref.url)}
                <ArrowUpRight size={14} />
              </a>
            </div>
          ))
        ) : (
          <p className="text-sm text-base-content/60">No references recorded.</p>
        )}
      </div>
    </section>
  );
}
