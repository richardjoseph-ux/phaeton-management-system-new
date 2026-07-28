import { useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import BillingStatementPDF from '@/components/billing/BillingStatementPDF';

export default function Accounting() {
  const [tab, setTab] = useState('statement');

  const tabClass = (active) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="p-6">
      <PageHeader title="Accounting" subtitle="Billing statement generation and accounting tools" />

      <div className="flex items-center gap-2 border-b mb-6">
        <button onClick={() => setTab('statement')} className={tabClass(tab === 'statement')}>
          Top Sheet
        </button>
      </div>

      {tab === 'statement' && <BillingStatementPDF />}
    </div>
  );
}