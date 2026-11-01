/* Day View owns stable, manually memoized callbacks for the shared sheet/swiper
 * state machine. The compiler's dependency inference incorrectly treats
 * stable React state setters as changing dependencies here.
 */
/* eslint-disable react-hooks/preserve-manual-memoization */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
const DayLayoutMenu = React.lazy(() => import('./DayLayoutMenu').then(m => ({ default: m.DayLayoutMenu })));
import { runBulkTaskActions } from './bulkTaskActions';
import { toggleCategoryDaySelection } from '../../../lib/categoryDaySelection';
import { formatSelectedTasksForClipboard, resolveTaskCompletionSortMode } from '../../../lib/taskOrder';
import { addDays, format, isToday } from 'date-fns';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Virtual } from 'swiper/modules';
import 'swiper/css/virtual';
import 'swiper/css/free-mode';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckSquare, CircleHelp, ChevronLeft, ChevronRight, Copy, MoreHorizontal, Trash2, ListOrdered, Settings2 } from 'lucide-react';
import { useInRouterContext, useNavigate } from 'react-router-dom';
import { makeRouteParentState } from '../../../lib/primarySwipeNavigation';
import { BottomSheet } from '../../ui/BottomSheet';
import { AppearanceContext } from '../../../hooks/appearanceContext';
import { systemRequestsReducedMotion } from '../../../lib/motionPreferences';
import { ConfirmS¶»§q«^