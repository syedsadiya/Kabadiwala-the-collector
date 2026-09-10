const STATUS_FLOW = ['COLLECTED', 'VERIFIED', 'SENT_TO_RECYCLER', 'RECYCLED'];

export default function Timeline({ collection }) {
  const idx = STATUS_FLOW.indexOf(collection.status);
  const journey = [
    { label: 'Household', done: true, d: collection.customer?.name },
    { label: 'Kabadiwala', done: true, d: collection.collector?.name },
    { label: 'Collection Center', done: idx >= 1, d: collection.center },
    { label: 'Authorized Recycler', done: idx >= 2, d: collection.recycler },
    { label: 'Recycled', done: idx >= 3, d: idx >= 3 ? 'Completed' : 'Pending' },
  ];
  return (
    <div className="timeline">
      {journey.map((j, i) => (
        <div className="tl-item" key={i}>
          <div className="tl-dot-col">
            <div className={`tl-dot ${j.done ? '' : 'pending'}`}>{j.done ? '✓' : i + 1}</div>
            {i < journey.length - 1 && <div className={`tl-bar ${j.done ? '' : 'pending'}`} />}
          </div>
          <div className="tl-content">
            <div className="t">{j.label}</div>
            <div className="d">{j.d || '—'}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
