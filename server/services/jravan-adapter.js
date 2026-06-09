// JRA-VAN / JV-Link 連携アダプタ雛形。
// 実運用ではWindows PC上でJV-Link SDK/COMを呼び、取得結果をこのDB形式に正規化します。
// Nodeから直接COMを呼ぶより、PowerShell/C#/Python側でJV-Linkを叩いてJSONを吐き、ここで取り込む構成を推奨。

export async function fetchData({ mode='manual', dateFrom, dateTo, target='weekend' } = {}) {
  throw new Error(
    `JRA-VAN adapter is not configured yet. mode=${mode}, target=${target}, dateFrom=${dateFrom||''}, dateTo=${dateTo||''}. ` +
    `Install JV-Link on Windows and implement scripts/jravan-export.ps1 or a C# bridge.`
  );
}
