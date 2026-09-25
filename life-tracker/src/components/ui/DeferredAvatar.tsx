import React from 'react';
import { useImageLoadGate } from '../../hooks/useImageLoadGate';
import { useTaskImage } from '../../hooks/useTaskImage';
import { Avatar, type AvatarProps } from './Avatar';

interface DeferredAvatarProps extends Omit<AvatarProps, 'src'> {
  fileId?: string;
  eager?: boolean;
}

export const DeferredAvatar: React.FC<DeferredAvatarProps> = ({
  fileId,
  eager = false,
  ...avatarProps
}) => {
  const { targetRef, shouldLoad } = useImageLoadGate<HTMLSpanElement>({ eager });
  const { imageUrl } = useTaskImage(fileId, shouldLoad);

  return (
    <span ref={targetRef} className="inline-flex flex-shrink-0">
      <Avatar src={imageUrl || undefined} {...avatarProps} />
    </span>
  );
};
