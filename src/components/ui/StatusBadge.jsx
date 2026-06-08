export default function StatusBadge({ status, type = 'account' }) {
  const config = {
    account: {
      Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Inactive: 'bg-red-50 text-red-700 border-red-200',
    },
    insurance: {
      Insured: 'bg-blue-50 text-blue-700 border-blue-200',
      Expired: 'bg-orange-50 text-orange-700 border-orange-200',
      Uninsured: 'bg-slate-100 text-slate-500 border-slate-200',
    },
    billing: {
      Open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Closed: 'bg-slate-100 text-slate-500 border-slate-200',
    },
  };

  const colors = config[type]?.[status] || 'bg-slate-100 text-slate-500 border-slate-200';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors}`}>
      {status}
    </span>
  );
}