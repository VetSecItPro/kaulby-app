import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { ArrowLeft, Database, HardDrive, Network, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getDatabaseData() {
  const [
    dbSizeResult,
    tableSizes,
    connectionCount,
    indexStats,
  ] = await Promise.all([
    // Database size
    db.execute(sql`SELECT pg_database_size(current_database()) as size`),

    // Table sizes and row counts
    db.execute(sql`
      SELECT
        relname as table_name,
        n_live_tup as row_count,
        pg_total_relation_size(quote_ident(relname)) as total_size
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(quote_ident(relname)) DESC
    `),

    // Active connections
    db.execute(sql`SELECT count(*) as count FROM pg_stat_activity`),

    // Index usage stats (top 20 by scans)
    db.execute(sql`
      SELECT
        indexrelname as index_name,
        relname as table_name,
        idx_scan as scan_count,
        pg_relation_size(indexrelid) as index_size
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
      LIMIT 20
    `),
  ]);

  const dbSize = Number(dbSizeResult.rows[0]?.size) || 0;
  const activeConnections = Number(connectionCount.rows[0]?.count) || 0;

  const tables = (tableSizes.rows as Array<{
    table_name: string;
    row_count: string | number;
    total_size: string | number;
  }>).map((t) => ({
    name: t.table_name,
    rowCount: Number(t.row_count) || 0,
    totalSize: Number(t.total_size) || 0,
  }));

  const totalRows = tables.reduce((sum, t) => sum + t.rowCount, 0);

  const indexes = (indexStats.rows as Array<{
    index_name: string;
    table_name: string;
    scan_count: string | number;
    index_size: string | number;
  }>).map((i) => ({
    name: i.index_name,
    tableName: i.table_name,
    scanCount: Number(i.scan_count) || 0,
    size: Number(i.index_size) || 0,
  }));

  return {
    dbSize,
    totalRows,
    activeConnections,
    tableCount: tables.length,
    tables,
    indexes,
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function DatabasePage() {
  // Auth + admin check handled by /manage/layout.tsx
  const data = await getDatabaseData();

  return (
    <div className="flex-1 flex-col space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manage/system">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Database</h1>
            <p className="text-muted-foreground">PostgreSQL (Neon) stats, table sizes, and indexes</p>
          </div>
        </div>
        <Badge variant="outline" className="border-green-500 text-green-500">
          Operational
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Size</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(data.dbSize)}</div>
            <p className="text-xs text-muted-foreground">Total on disk</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rows</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.totalRows)}</div>
            <p className="text-xs text-muted-foreground">Across all tables</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeConnections}</div>
            <p className="text-xs text-muted-foreground">Active connections</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tables</CardTitle>
            <TableIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.tableCount}</div>
            <p className="text-xs text-muted-foreground">User tables</p>
          </CardContent>
        </Card>
      </div>

      {/* Table Sizes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            Table Sizes
          </CardTitle>
          <CardDescription>All tables sorted by total size (data + indexes)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right">% of DB</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tables.map((table) => {
                const percentage = data.dbSize > 0 ? (table.totalSize / data.dbSize) * 100 : 0;
                return (
                  <TableRow key={table.name}>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{table.name}</code>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(table.rowCount)}</TableCell>
                    <TableCell className="text-right font-medium">{formatBytes(table.totalSize)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs w-12">{percentage.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Index Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TableIcon className="h-5 w-5" />
            Top Indexes by Scan Count
          </CardTitle>
          <CardDescription>Most frequently used indexes</CardDescription>
        </CardHeader>
        <CardContent>
          {data.indexes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Index</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead className="text-right">Scans</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.indexes.map((idx) => (
                  <TableRow key={idx.name}>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">{idx.name}</code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{idx.tableName}</TableCell>
                    <TableCell className="text-right font-medium">{formatNumber(idx.scanCount)}</TableCell>
                    <TableCell className="text-right">{formatBytes(idx.size)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No index data</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
