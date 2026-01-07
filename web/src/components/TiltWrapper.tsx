"use client";

import Tilt from "react-parallax-tilt";
import { ReactNode, CSSProperties } from "react";

interface TiltWrapperProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  tiltMaxAngleX?: number;
  tiltMaxAngleY?: number;
  perspective?: number;
  glareEnable?: boolean;
  glareMaxOpacity?: number;
  glarePosition?: "all" | "top" | "right" | "bottom" | "left";
  scale?: number;
  transitionSpeed?: number;
}

export default function TiltWrapper(props: TiltWrapperProps) {
  return <Tilt {...props}>{props.children}</Tilt>;
}
