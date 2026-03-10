import React, { useEffect, useState } from 'react';
import { Card } from './ui/Card';
import { ChevronDown } from './ui/Icons';
import { getReceiptsByRetailer } from '../../storage/receipts';
import type { ScrapedReceipt } from '../../types/scraper';
import { RETAILERS } from '../constants';

interface Props {
  retailerId: string;
  onBack: () => void;
}

export function RetailerDetail({ retailerId, onBack }: Props) {
  const [receipts, setReceipts] = useState<ScrapedReceipt[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const retailer = RETAILERS.find((r) => r.id === retailerId);

  useEffect(() => {
    getReceiptsByRetailer(retailerId).then((r) => {
      // Sort by date descending, coerce dates
      const sorted = r
        .map((receipt) => ({
          ...receipt,
          orderDate: new Date(receipt.orderDate),
        }))
        .sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
      setReceipts(sorted);
      setLoading(false);
    });
  }, [retailerId]);

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 cursor-pointer"
      >
        <ChevronDown size={12} className="rotate-90" />
        Back
      </button>

      <div className="flex items-center gap-2 mb-3">
        {retailer && <span className="text-lg">{retailer.icon}</span>}
        <h2 className="font-sans text-sm font-semibold text-foreground">
          {retailer?.name ?? retailerId}
        </h2>
        <span className="text-xs text-muted-foreground ml-auto">
          {receipts.length} receipt{receipts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-4">Loading...</p>
      ) : receipts.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">
          No orders synced yet
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {receipts.map((receipt) => (
            <OrderCard
              key={receipt.orderId}
              receipt={receipt}
              expanded={expandedOrder === receipt.orderId}
              onToggle={() =>
                setExpandedOrder((prev) =>
                  prev === receipt.orderId ? null : receipt.orderId
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  receipt,
  expanded,
  onToggle,
}: {
  receipt: ScrapedReceipt;
  expanded: boolean;
  onToggle: () => void;
}) {
  const date = new Date(receipt.orderDate);
  const dateStr = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card className="cursor-pointer" onClick={onToggle}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground truncate">
              #{receipt.orderId}
            </span>
            {receipt.orderUrl && (
              <a
                href={receipt.orderUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] text-primary hover:underline shrink-0"
              >
                View
              </a>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span>{dateStr}</span>
            {receipt.paymentMethods && receipt.paymentMethods.length > 0 && (
              <>
                <span>·</span>
                <span>
                  {receipt.paymentMethods.map((p) =>
                    p.last4 ? `${p.type} ••${p.last4}` : p.type
                  ).join(', ')}
                </span>
              </>
            )}
          </div>
        </div>
        <span className="text-xs font-semibold text-foreground shrink-0">
          ${receipt.totalAmount.toFixed(2)}
        </span>
        <ChevronDown
          size={12}
          className={`text-muted-foreground transition-transform shrink-0 ${
            expanded ? '' : '-rotate-90'
          }`}
        />
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-border">
          {receipt.items.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No item details available
            </p>
          ) : (
            <div className="space-y-1">
              {receipt.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between text-[11px] gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-foreground line-clamp-1">
                      {item.name}
                    </span>
                    {item.quantity > 1 && (
                      <span className="text-muted-foreground ml-1">
                        x{item.quantity} @ ${item.unitPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <span className="text-foreground shrink-0">
                    ${item.totalPrice.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {receipt.tax != null && receipt.tax > 0 && (
            <div className="flex justify-between text-[11px] text-muted-foreground mt-1 pt-1 border-t border-border/50">
              <span>Tax</span>
              <span>${receipt.tax.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
