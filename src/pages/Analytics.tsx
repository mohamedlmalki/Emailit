import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, RefreshCw, AlertCircle, CheckCircle2, XCircle, 
  Clock, Mail, ChevronLeft, ChevronRight, MoreHorizontal, Eye,
  MailOpen, Download, Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAccounts } from '@/contexts/AccountContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3006';

interface EmailLog {
  id: string;
  batchId: string;
  to: string;
  from: string;
  subject: string;
  status: 'delivered' | 'failed' | 'pending';
  errorMessage: string | null;
  isOpened: boolean;
  openCount: number;
  sentAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const Analytics: React.FC = () => {
  const { currentAccount } = useAccounts();
  
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 100, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  // --- Stats Calculation (Current View) ---
  const stats = useMemo(() => {
    return {
      delivered: logs.filter(l => l.status === 'delivered').length,
      failed: logs.filter(l => l.status === 'failed').length,
      opened: logs.filter(l => l.isOpened).length,
      unopened: logs.filter(l => !l.isOpened).length
    };
  }, [logs]);

  // --- Export Functionality ---
  const handleExport = () => {
    if (logs.length === 0) {
      toast.error("No logs to export");
      return;
    }

    const textContent = logs.map(r => r.to).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-export-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${logs.length} emails`);
  };

  const fetchLogs = async (page = 1) => {
    if (!currentAccount) return;

    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        accountId: currentAccount.id,
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (statusFilter !== 'all') {
        queryParams.append('status', statusFilter);
      }

      const response = await fetch(`${apiUrl}/api/email/log?${queryParams}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch logs');
      }

      if (result.success) {
        setLogs(result.data);
        setPagination(result.pagination);
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
      toast.error("Failed to refresh logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentAccount) {
      fetchLogs(1);
    }
  }, [currentAccount, statusFilter]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchLogs(newPage);
    }
  };

  if (!currentAccount) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">No Account Selected</h2>
            <p className="text-muted-foreground">Select a VoidValue account to view analytics.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center shadow-colored">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Logs</h1>
            <p className="text-muted-foreground text-sm">Track delivery status and engagement</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md bg-background">
            <div className="px-2 border-r text-muted-foreground"><Filter className="w-3.5 h-3.5" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] border-0 focus:ring-0">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={handleExport} disabled={isLoading}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>

          <Button variant="outline" onClick={() => fetchLogs(pagination.page)} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-muted/30 border-none shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Delivered</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.delivered}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-200 dark:text-green-900" />
          </CardContent>
        </Card>
        <Card className="bg-muted/30 border-none shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Failed</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-200 dark:text-red-900" />
          </CardContent>
        </Card>
        <Card className="bg-muted/30 border-none shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Opened</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.opened}</p>
            </div>
            <MailOpen className="w-8 h-8 text-blue-200 dark:text-blue-900" />
          </CardContent>
        </Card>
        <Card className="bg-muted/30 border-none shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unopened</p>
              <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.unopened}</p>
            </div>
            <Mail className="w-8 h-8 text-gray-200 dark:text-gray-800" />
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="border-t-4 border-t-primary shadow-md">
        <CardContent className="p-0">
          <div className="rounded-md border-b">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="text-center w-[120px]">Tracking</TableHead>
                  <TableHead className="text-right">Sent At</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" /> Loading logs...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No logs found for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                      <TableCell>
                        {log.status === 'delivered' && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Delivered
                          </Badge>
                        )}
                        {log.status === 'failed' && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 gap-1">
                            <XCircle className="w-3 h-3" /> Failed
                          </Badge>
                        )}
                        {log.status === 'pending' && (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800 gap-1">
                            <Clock className="w-3 h-3" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate" title={log.subject}>
                        {log.subject}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.to}
                      </TableCell>
                      
                      {/* Tracking Column */}
                      <TableCell className="text-center">
                        {log.isOpened ? (
                          <div 
                            className="flex items-center justify-center text-blue-600 dark:text-blue-400" 
                            title={`Opened ${log.openCount} times`}
                          >
                            <MailOpen className="w-4 h-4 mr-1.5" />
                            <span className="text-xs font-semibold">Opened ({log.openCount})</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center text-muted-foreground/50">
                            <Mail className="w-4 h-4 mr-1.5" />
                            <span className="text-xs">Unopened</span>
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.sentAt), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between px-4 py-4 border-t bg-muted/20">
            <div className="text-xs text-muted-foreground">
              Showing <strong>{logs.length}</strong> of <strong>{pagination.total}</strong> results
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-xs font-medium px-2">
                Page {pagination.page} of {pagination.totalPages || 1}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || isLoading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" /> Message Details
            </DialogTitle>
            <DialogDescription>
              ID: <span className="font-mono text-xs">{selectedLog?.id}</span>
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4 text-sm mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recipient</p>
                  <p className="font-mono bg-muted/50 p-1.5 rounded border">{selectedLog.to}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">From</p>
                  <p className="font-mono bg-muted/50 p-1.5 rounded border">{selectedLog.from}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject</p>
                <p className="font-medium p-1.5">{selectedLog.subject}</p>
              </div>

              {selectedLog.status === 'failed' && selectedLog.errorMessage && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-400 font-semibold mb-1">
                    <AlertCircle className="w-4 h-4" /> Delivery Failed
                  </div>
                  <p className="text-xs text-red-700 dark:text-red-300 font-mono break-all">
                    {selectedLog.errorMessage}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-md border">
                <div className="flex items-center gap-2">
                    {selectedLog.isOpened ? (
                        <div className="flex items-center text-blue-600 dark:text-blue-400">
                            <MailOpen className="w-4 h-4 mr-2" />
                            <span className="font-semibold">Opened {selectedLog.openCount} times</span>
                        </div>
                    ) : (
                        <div className="flex items-center text-muted-foreground">
                            <Mail className="w-4 h-4 mr-2" />
                            <span>Not yet opened</span>
                        </div>
                    )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2 border-t">
                <div>Batch ID: <span className="font-mono">{selectedLog.batchId}</span></div>
                <div className="text-right">Sent: {format(new Date(selectedLog.sentAt), 'PPpp')}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};