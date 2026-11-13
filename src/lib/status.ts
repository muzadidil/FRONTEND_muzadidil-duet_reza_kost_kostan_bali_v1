export function statusColor(status: string): string {
  switch (status) {
    case "paid":
    case "completed":
      return "bg-green-100 text-green-800";
    case "requested":
    case "approved":
      return "bg-amber-100 text-amber-800";
    case "refunded":
      return "bg-brand-soft text-brand-dark";
    default:
      return "bg-slate-200 text-slate-700";
  }
}
