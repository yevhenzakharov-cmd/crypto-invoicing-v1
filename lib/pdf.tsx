"use client";

import { BRAND } from "./brand";
import { CHAIN_LABELS, findToken, type SupportedChainId } from "./chains";
import { amountDue, computeTotals, type Invoice } from "./invoice";
import { formatFixed, formatTokenUnits } from "./money";

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFilename(s: string, fallback: string) {
  const clean = s.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return clean || fallback;
}

/** Generates the invoice PDF entirely in the browser. */
export async function downloadInvoicePdf(inv: Invoice, opts: { qrDataUrl?: string } = {}) {
  const { pdf, Document, Page, Text, View, Image, StyleSheet } = await import("@react-pdf/renderer");
  const t = computeTotals(inv);
  const token = findToken(inv.payment.chainId, inv.payment.token);
  const unit = inv.payment.method === "crypto" && token ? token.symbol : "";
  const due = amountDue(inv);
  const money = (x: bigint) => formatFixed(x, { minDp: 2, maxDp: token ? Math.min(token.decimals, 8) : 2 });

  const s = StyleSheet.create({
    page: { padding: 44, fontSize: 9.5, fontFamily: "Helvetica", color: "#141414" },
    row: { flexDirection: "row" },
    h1: { fontSize: 26, color: "#9a9aa2", fontFamily: "Helvetica" },
    small: { fontSize: 8, color: "#6b6b75", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
    bold: { fontFamily: "Helvetica-Bold" },
    th: { backgroundColor: "#141414", color: "#ffffff", paddingVertical: 6, paddingHorizontal: 6, fontFamily: "Helvetica-Bold", fontSize: 8.5 },
    td: { paddingVertical: 7, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#dddde2" },
    mono: { fontFamily: "Courier" },
  });
  const col = { desc: "52%", qty: "12%", rate: "18%", amt: "18%" } as const;

  const doc = (
    <Document title={`Invoice ${inv.number}`} author={inv.from.name || undefined} creator={BRAND.name || "Invoice"} producer="">
      <Page size="A4" style={s.page}>
        <View style={[s.row, { justifyContent: "space-between", marginBottom: 28 }]}>
          <View style={{ maxWidth: "55%" }}>
            <Text style={[s.bold, { fontSize: 13, marginBottom: 4 }]}>{inv.from.name}</Text>
            {inv.from.lines.filter(Boolean).map((l, i) => (
              <Text key={i} style={{ color: "#4a4a52", marginBottom: 1.5 }}>{l}</Text>
            ))}
          </View>
          <Text style={s.h1}>Invoice</Text>
        </View>

        <View style={[s.row, { justifyContent: "space-between", marginBottom: 24 }]}>
          <View style={{ maxWidth: "50%" }}>
            <Text style={s.small}>Bill to</Text>
            <Text style={[s.bold, { marginBottom: 3 }]}>{inv.to.name}</Text>
            {inv.to.lines.filter(Boolean).map((l, i) => (
              <Text key={i} style={{ color: "#4a4a52", marginBottom: 1.5 }}>{l}</Text>
            ))}
          </View>
          <View style={{ width: 190 }}>
            {[
              ["Invoice #", inv.number],
              ["Invoice date", inv.issueDate],
              ["Due date", inv.dueDate],
            ].map(([k, v]) => (
              <View key={k} style={[s.row, { justifyContent: "space-between", marginBottom: 4 }]}>
                <Text style={{ color: "#6b6b75" }}>{k}</Text>
                <Text style={s.bold}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.row}>
          <Text style={[s.th, { width: col.desc }]}>Item description</Text>
          <Text style={[s.th, { width: col.qty, textAlign: "right" }]}>Qty</Text>
          <Text style={[s.th, { width: col.rate, textAlign: "right" }]}>Rate</Text>
          <Text style={[s.th, { width: col.amt, textAlign: "right" }]}>Amount</Text>
        </View>
        {inv.items.map((it, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={[s.td, { width: col.desc }]}>{it.description}</Text>
            <Text style={[s.td, { width: col.qty, textAlign: "right" }]}>{it.qty}</Text>
            <Text style={[s.td, { width: col.rate, textAlign: "right" }]}>{it.rate}</Text>
            <Text style={[s.td, { width: col.amt, textAlign: "right" }]}>{money(t.lines[i])}</Text>
          </View>
        ))}

        <View style={{ alignSelf: "flex-end", width: 230, marginTop: 14 }}>
          {[
            ["Subtotal", money(t.subtotal)],
            [`Tax (${inv.taxPercent || 0}%)`, money(t.tax)],
            ["Shipping", money(t.shipping)],
            ["Discount", `(${money(t.discount)})`],
          ].map(([k, v]) => (
            <View key={k} style={[s.row, { justifyContent: "space-between", paddingVertical: 3 }]}>
              <Text style={{ color: "#4a4a52" }}>{k}</Text>
              <Text>{v}</Text>
            </View>
          ))}
          <View style={[s.row, { justifyContent: "space-between", backgroundColor: "#f0f0f2", padding: 8, marginTop: 6 }]}>
            <Text style={s.bold}>TOTAL</Text>
            <Text style={s.bold}>{unit} {money(t.total)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 28 }} wrap={false}>
          <Text style={s.small}>Payment information</Text>
          {inv.payment.method === "crypto" && token ? (
            <View style={[s.row, { gap: 16, alignItems: "flex-start" }]}>
              {opts.qrDataUrl && <Image src={opts.qrDataUrl} style={{ width: 96, height: 96 }} />}
              <View style={{ flex: 1 }}>
                <Text style={{ marginBottom: 3 }}>
                  Pay {due !== null ? formatTokenUnits(due, token.decimals) : money(t.total)} {token.symbol} on {CHAIN_LABELS[inv.payment.chainId as SupportedChainId]}
                </Text>
                <Text style={{ color: "#6b6b75", marginBottom: 2 }}>To wallet address:</Text>
                <Text style={s.mono}>{inv.payment.recipient}</Text>
                {token.address && (
                  <Text style={{ color: "#6b6b75", marginTop: 6, fontSize: 8 }}>Token contract: {token.address}</Text>
                )}
                <Text style={{ color: "#9a6a1a", marginTop: 6, fontSize: 8 }}>
                  Send only {token.symbol} on {CHAIN_LABELS[inv.payment.chainId as SupportedChainId]}. Funds sent on another network may be lost.
                </Text>
              </View>
            </View>
          ) : (
            <View>
              {inv.payment.fiat.bank ? <Text>Bank: {inv.payment.fiat.bank}</Text> : null}
              {inv.payment.fiat.account ? <Text>Account / IBAN: {inv.payment.fiat.account}</Text> : null}
              {inv.payment.fiat.details ? <Text style={{ color: "#4a4a52", marginTop: 3 }}>{inv.payment.fiat.details}</Text> : null}
            </View>
          )}
        </View>

        {(inv.notes || inv.terms) && (
          <View style={[s.row, { gap: 24, marginTop: 24 }]} wrap={false}>
            {inv.notes ? (
              <View style={{ flex: 1 }}>
                <Text style={s.small}>Notes</Text>
                <Text style={{ color: "#4a4a52", lineHeight: 1.4 }}>{inv.notes}</Text>
              </View>
            ) : null}
            {inv.terms ? (
              <View style={{ flex: 1 }}>
                <Text style={s.small}>Terms</Text>
                <Text style={{ color: "#4a4a52", lineHeight: 1.4 }}>{inv.terms}</Text>
              </View>
            ) : null}
          </View>
        )}
      </Page>
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  triggerDownload(blob, `${safeFilename(inv.number, "invoice")}.pdf`);
}
