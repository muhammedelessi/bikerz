import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  Search,
  MoreHorizontal,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Send,
  Filter,
  User,
  Calendar,
  Tag,
  Timer,
  Inbox,
  AlertCircle,
  Loader2,
  StickyNote,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { useTranslation } from 'react-i18next';

type TicketCategory = 'technical' | 'billing' | 'course_content' | 'account' | 'refund' | 'certificate' | 'other';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
type TicketStatus = 'open' | 'in_progress' | 'waiting_response' | 'resolved' | 'closed';

const categoryConfig = (t: any): Record<TicketCategory, { label: string; color: string }> => ({
  technical: { label: t('admin.support.categories.technical'), color: 'bg-blue-500/10 text-blue-600' },
  billing: { label: t('admin.support.categories.billing'), color: 'bg-green-500/10 text-green-600' },
  course_content: { label: t('admin.support.categories.course_content'), color: 'bg-purple-500/10 text-purple-600' },
  account: { label: t('admin.support.categories.account'), color: 'bg-orange-500/10 text-orange-600' },
  refund: { label: t('admin.support.categories.refund'), color: 'bg-red-500/10 text-red-600' },
  certificate: { label: t('admin.support.categories.certificate'), color: 'bg-yellow-500/10 text-yellow-600' },
  other: { label: t('admin.support.categories.other'), color: 'bg-gray-500/10 text-gray-600' },
});

const priorityConfig = (t: any): Record<TicketPriority, { label: string; color: string; icon: React.ElementType }> => ({
  low: { label: t('admin.support.priorities.low'), color: 'bg-gray-500/10 text-gray-600 border-gray-300', icon: Clock },
  medium: { label: t('admin.support.priorities.medium'), color: 'bg-blue-500/10 text-blue-600 border-blue-300', icon: AlertCircle },
  high: { label: t('admin.support.priorities.high'), color: 'bg-orange-500/10 text-orange-600 border-orange-300', icon: AlertTriangle },
  urgent: { label: t('admin.support.priorities.urgent'), color: 'bg-red-500/10 text-red-600 border-red-300', icon: XCircle },
});

const statusConfig = (t: any): Record<TicketStatus, { label: string; color: string; icon: React.ElementType }> => ({
  open: { label: t('admin.support.statuses.open'), color: 'bg-blue-500/10 text-blue-600', icon: Inbox },
  in_progress: { label: t('admin.support.statuses.in_progress'), color: 'bg-yellow-500/10 text-yellow-600', icon: Loader2 },
  waiting_response: { label: t('admin.support.statuses.waiting_response'), color: 'bg-purple-500/10 text-purple-600', icon: Clock },
  resolved: { label: t('admin.support.statuses.resolved'), color: 'bg-green-500/10 text-green-600', icon: CheckCircle },
  closed: { label: t('admin.support.statuses.closed'), color: 'bg-gray-500/10 text-gray-600', icon: XCircle },
});

const AdminSupport = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const categories = categoryConfig(t);
  const priorities = priorityConfig(t);
  const statuses = statusConfig(t);

  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  // Fetch tickets
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['admin-support-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles
      const userIds = [...new Set(data?.map(t => t.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      return data?.map(ticket => ({
        ...ticket,
        profile: profiles?.find(p => p.user_id === ticket.user_id) || null,
      }));
    },
  });

  // Fetch ticket messages
  const { data: ticketMessages } = useQuery({
    queryKey: ['ticket-messages', selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket?.id) return [];
      
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', selectedTicket.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch sender profiles
      const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', senderIds);

      return data?.map(message => ({
        ...message,
        sender: profiles?.find(p => p.user_id === message.sender_id) || null,
      }));
    },
    enabled: !!selectedTicket?.id,
  });

  // Update ticket mutation
  const updateTicketMutation = useMutation({
    mutationFn: async (updates: { id: string; status?: TicketStatus; priority?: TicketPriority; assigned_to?: string }) => {
      const updateData: any = { ...updates };
      delete updateData.id;

      if (updates.status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      } else if (updates.status === 'closed') {
        updateData.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updateData)
        .eq('id', updates.id);

      if (error) throw error;
      
      // Log the action
      if (updates.status) {
        await logAction({
          action: 'ticket_status_changed',
          entityType: 'ticket',
          entityId: updates.id,
          oldData: { status: selectedTicket?.status },
          newData: { status: updates.status },
        });
      }
      if (updates.priority) {
        await logAction({
          action: 'ticket_priority_changed',
          entityType: 'ticket',
          entityId: updates.id,
          oldData: { priority: selectedTicket?.priority },
          newData: { priority: updates.priority },
        });
      }
      if (updates.assigned_to) {
        await logAction({
          action: 'ticket_assigned',
          entityType: 'ticket',
          entityId: updates.id,
          newData: { assigned_to: updates.assigned_to },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      toast({
        title: t('admin.support.updated'),
        description: t('admin.support.updateSuccess'),
      });
    },
  });

  // Send reply mutation
  const sendReplyMutation = useMutation({
    mutationFn: async ({ ticketId, message, isInternal }: { ticketId: string; message: string; isInternal: boolean }) => {
      const { error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: user?.id,
          message,
          is_internal_note: isInternal,
        });

      if (error) throw error;

      // Update first response time if this is the first admin reply
      if (!isInternal && !selectedTicket?.first_response_at) {
        await supabase
          .from('support_tickets')
          .update({ 
            first_response_at: new Date().toISOString(),
            status: 'in_progress' as TicketStatus,
          })
          .eq('id', ticketId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', selectedTicket?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      setReplyMessage('');
      toast({
        title: t('admin.support.sent'),
        description: t('admin.support.sendSuccess'),
      });
    },
  });

  // Filter tickets
  const filteredTickets = tickets?.filter(ticket => {
    const matchesSearch = 
      ticket.ticket_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Stats
  const stats = {
    total: tickets?.length || 0,
    open: tickets?.filter(t => t.status === 'open').length || 0,
    inProgress: tickets?.filter(t => t.status === 'in_progress').length || 0,
    overdueSLA: tickets?.filter(t => t.sla_due_at && isPast(new Date(t.sla_due_at)) && !['resolved', 'closed'].includes(t.status)).length || 0,
  };

  const getSLAStatus = (ticket: any) => {
    if (!ticket.sla_due_at || ['resolved', 'closed'].includes(ticket.status)) return null;
    const dueDate = new Date(ticket.sla_due_at);
    const isOverdue = isPast(dueDate);
    return {
      isOverdue,
      text: isOverdue 
        ? t('admin.support.overdue')
        : formatDistanceToNow(dueDate, { addSuffix: true }),
    };
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('admin.support.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('admin.support.subtitle')}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('admin.support.totalTickets')}</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <MessageSquare className="w-5 h-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('admin.support.open')}</p>
                  <p className="text-2xl font-bold">{stats.open}</p>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded-full">
                  <Inbox className="w-5 h-5 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('admin.support.inProgress')}</p>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-full">
                  <Loader2 className="w-5 h-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('admin.support.overdueSLA')}</p>
                  <p className="text-2xl font-bold text-red-500">{stats.overdueSLA}</p>
                </div>
                <div className="p-3 bg-red-500/10 rounded-full">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('admin.support.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder={t('admin.support.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.support.allStatus')}</SelectItem>
                  {(Object.keys(statuses) as TicketStatus[]).map(status => (
                    <SelectItem key={status} value={status}>
                      {statuses[status].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder={t('admin.support.priority')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.support.allPriorities')}</SelectItem>
                  {(Object.keys(priorities) as TicketPriority[]).map(priority => (
                    <SelectItem key={priority} value={priority}>
                      {priorities[priority].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.support.ticketsList')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.support.ticketNumber')}</TableHead>
                    <TableHead>{t('admin.support.user')}</TableHead>
                    <TableHead>{t('admin.support.subject')}</TableHead>
                    <TableHead>{t('admin.support.category')}</TableHead>
                    <TableHead>{t('admin.support.priority')}</TableHead>
                    <TableHead>{t('admin.support.status')}</TableHead>
                    <TableHead>{t('admin.support.sla')}</TableHead>
                    <TableHead>{t('admin.support.date')}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets?.map((ticket) => {
                    const slaStatus = getSLAStatus(ticket);
                    const StatusIcon = statuses[ticket.status as TicketStatus]?.icon || Inbox;
                    const PriorityIcon = priorities[ticket.priority as TicketPriority]?.icon || Clock;
                    
                    return (
                      <TableRow 
                        key={ticket.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        <TableCell className="font-mono text-sm">
                          {ticket.ticket_number}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={ticket.profile?.avatar_url || ''} />
                              <AvatarFallback>{ticket.profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{ticket.profile?.full_name || t('admin.support.unknown')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {isRTL ? ticket.subject_ar || ticket.subject : ticket.subject}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={categories[ticket.category as TicketCategory]?.color}>
                            {categories[ticket.category as TicketCategory]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={priorities[ticket.priority as TicketPriority]?.color}>
                            <PriorityIcon className="w-3 h-3 me-1" />
                            {priorities[ticket.priority as TicketPriority]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statuses[ticket.status as TicketStatus]?.color}>
                            <StatusIcon className="w-3 h-3 me-1" />
                            {statuses[ticket.status as TicketStatus]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {slaStatus && (
                            <span className={`text-xs font-medium ${slaStatus.isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {slaStatus.text}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(ticket.created_at), 'MMM dd, HH:mm')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); }}>
                                <MessageSquare className="w-4 h-4 me-2" />
                                {t('admin.support.viewDetails')}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  updateTicketMutation.mutate({ id: ticket.id, status: 'resolved' }); 
                                }}
                                className="text-green-600"
                              >
                                <CheckCircle className="w-4 h-4 me-2" />
                                {t('admin.support.markResolved')}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  updateTicketMutation.mutate({ id: ticket.id, status: 'closed' }); 
                                }}
                              >
                                <XCircle className="w-4 h-4 me-2" />
                                {t('admin.support.closeTicket')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredTickets?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {t('admin.support.noTickets')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Ticket Detail Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{selectedTicket?.ticket_number}</span>
                <span>-</span>
                <span>{isRTL ? selectedTicket?.subject_ar || selectedTicket?.subject : selectedTicket?.subject}</span>
              </DialogTitle>
              <DialogDescription>
                {t('admin.support.ticketDetails')}
              </DialogDescription>
            </DialogHeader>

            {selectedTicket && (
              <div className="space-y-4">
                {/* Ticket Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('admin.support.status')}</p>
                    <Select
                      value={selectedTicket.status}
                      onValueChange={(value) => {
                        updateTicketMutation.mutate({ id: selectedTicket.id, status: value as TicketStatus });
                        setSelectedTicket({ ...selectedTicket, status: value });
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(statuses) as TicketStatus[]).map(status => (
                          <SelectItem key={status} value={status}>
                            {statuses[status].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('admin.support.priority')}</p>
                    <Select
                      value={selectedTicket.priority}
                      onValueChange={(value) => {
                        updateTicketMutation.mutate({ id: selectedTicket.id, priority: value as TicketPriority });
                        setSelectedTicket({ ...selectedTicket, priority: value });
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(priorities) as TicketPriority[]).map(priority => (
                          <SelectItem key={priority} value={priority}>
                            {priorities[priority].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('admin.support.category')}</p>
                    <Badge variant="outline" className={categoryConfig(t)[selectedTicket.category as TicketCategory]?.color}>
                      {categories[selectedTicket.category as TicketCategory]?.label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('admin.support.slaDue')}</p>
                    {selectedTicket.sla_due_at && (
                      <span className={`text-sm ${isPast(new Date(selectedTicket.sla_due_at)) ? 'text-red-500 font-medium' : ''}`}>
                        {format(new Date(selectedTicket.sla_due_at), 'MMM dd, HH:mm')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Original Message */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedTicket.profile?.avatar_url || ''} />
                      <AvatarFallback>{selectedTicket.profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{selectedTicket.profile?.full_name || t('admin.support.unknown')}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(selectedTicket.created_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">
                    {isRTL ? selectedTicket.description_ar || selectedTicket.description : selectedTicket.description}
                  </p>
                </div>

                {/* Messages */}
                <ScrollArea className="h-[200px] border rounded-lg p-4">
                  {ticketMessages?.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">
                      {t('admin.support.noReplies')}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {ticketMessages?.map((message: any) => (
                        <div 
                          key={message.id} 
                          className={`p-3 rounded-lg ${message.is_internal_note ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-muted/50'}`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={message.sender?.avatar_url || ''} />
                              <AvatarFallback className="text-xs">
                                {message.sender?.full_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{message.sender?.full_name || t('admin.support.unknown')}</span>
                            {message.is_internal_note && (
                              <Badge variant="outline" className="text-xs bg-yellow-500/10">
                                 <StickyNote className="w-3 h-3 me-1" />
                                 {t('admin.support.internalNote')}
                               </Badge>
                            )}
                            <span className="text-xs text-muted-foreground ms-auto">
                              {format(new Date(message.created_at), 'MMM dd, HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Reply Box */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={isInternalNote ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => setIsInternalNote(false)}
                    >
                      <MessageSquare className="w-4 h-4 me-1" />
                      {t('admin.support.reply')}
                    </Button>
                    <Button
                      variant={isInternalNote ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setIsInternalNote(true)}
                    >
                      <StickyNote className="w-4 h-4 me-1" />
                      {t('admin.support.internalNote')}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder={isInternalNote 
                        ? t('admin.support.addInternalNotePlaceholder')
                        : t('admin.support.typeReplyPlaceholder')
                      }
                      rows={3}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => sendReplyMutation.mutate({
                        ticketId: selectedTicket.id,
                        message: replyMessage,
                        isInternal: isInternalNote,
                      })}
                      disabled={!replyMessage.trim() || sendReplyMutation.isPending}
                    >
                      <Send className="w-4 h-4 me-2" />
                       {isInternalNote 
                        ? t('admin.support.addNote')
                        : t('admin.support.sendReply')
                      }
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminSupport;
