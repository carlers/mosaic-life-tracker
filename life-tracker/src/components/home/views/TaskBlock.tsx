import React, { useEffect, useState } from 'react';
import { getImageAsBlobUrl } from '../../../lib/storage';
import type { TaskDocument } from '../../../db/schema';

interface TaskBlockProps {
  task: TaskDocument;
  categoryColor: string;
}

export const TaskBlock: React.FC<TaskBlockProps> = ({ task, categoryColor }) => {
  const [imageBlobUrl, setImageBlobUrl] = useState<string>('');

  useEffect(() => {
    if (task.image && task.image.trim() !== '') {
      getImageAsBlobUrl(task.image)
        .then(url => setImageBlobUrl(url))
        .catch(err => console.error('[TaskBlock] Failed to load image:', err));
    } else {
      setImageBlobUrl('');
    }

    return () => {
      if (imageBlobUrl) {
        URL.revokeObjectURL(imageBlobUrl);
      }
    };
  }, [task.image]);

  const bgColor = task.completed ? categoryColor : '#374151';
  const textColor = task.completed ? 'text-white' : 'text-gray-400';

  return (
    <div
      className={`text-[9px] px-1 py-0.5 w-full font-medium rounded-[3px] overflow-hidden ${textColor}`}
      style={{ backgroundColor: bgColor }}
      title={task.title}
    >
      <div className="flex flex-col gap-0.5">
        <span className="block overflow-hidden whitespace-nowrap">{task.title}</span>
        {task.image && task.image.trim() !== '' && imageBlobUrl && (
          <img 
            src={imageBlobUrl} 
            alt=""
            className="w-full h-6 object-cover rounded-[2px] mt-0.5"
          />
        )}
      </div>
    </div>
  );
};