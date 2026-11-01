import React, { useRef, useState } from 'react';
import { useFeatureEnabled } from '../../../hooks/useFeatureEnabled';
import { TaskDateEditor } from './TaskDateEditor';
import { useRetainedSheetValue } from '../../../hooks/useRetainedSheetValue';
import { BottomSheet } from '../../ui/BottomSheet';
import {
  Pencil,
  Trash2,
  FileText,
  Clock,
  ArrowRight,
  RotateCcw,
  CheckCircle,
  Archive,
  Image as ImageIcon,
  Eye,
  Copy,
  Link2,
  Users,
} from 'lucide-react';
import { addDays, format } from 'date-fns';
import {
  resolveVisibility,
  isInheriting,
  labelForVisibility,
  type TaskVisibility,
} from '../../../lib/visibility';
import type { TaskDocument, CategoryDocument } from '../../../db/schema';

interface TaskActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDocument | null;
  category: CategoryDocument | null;
  onEdit: () => void;
  onDelete: () => void;
  onMemo: () => void;
  onChangeDate: (date: string) => Promise<unknown> | unknown;
  onVisibility: () => void;
  onShare: () => void;
  onAddPhoto: () => void;
  onViewPhoto: () => void;
  onDeletePhoto: () => void;
  onDoItTomorrowOrToday: () => void;
  onMoveToBacklog: () => void;
  onLinkToBucketList?: () => void;
}

export const TaskActionSheet: React.FC<TaskActionSheetProps> = ({
  isOpen,
  onClose,
  task: incomingTask,
  category,
  onEdit,
  onDelete,
  onMemo,
  onChangeDate,
  onVisibility,
  onShare,
  onAddPhoto,
  onViewPhoto,
  onDeletePhoto,
  onDoItTomorrowOrToday¶»§q«^