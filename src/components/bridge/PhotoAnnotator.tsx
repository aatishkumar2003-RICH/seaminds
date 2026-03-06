import { useRef, useEffect, useState, useCallback } from "react";
import { Undo2, Trash2, Send, Pencil, Circle, MoveRight, Type, ZoomIn, ZoomOut, Maximize } from "lucide-react";

type Props = {
  imageSrc: string;
  onSubmit: (annotatedDataUrl: string) => void;
  onCancel: () => void;
};

const COLORS = ["#FF0000", "#D4AF37", "#00FF00", "#00BFFF", "#FFFFFF"];
const BRUSH_SIZES = [3, 6, 12];

type DrawPoint = { x: number; y: number };
type Tool = "draw" | "arrow" | "text";

type Annotation =
  | { type: "stroke"; points: DrawPoint[]; color: string; size: number }
  | { type: "arrow"; from: DrawPoint; to: DrawPoint; color: string; size: number }
  | { type: "text"; pos: DrawPoint; text: string; color: string; fontSize: number };

const drawArrowhead = (ctx: CanvasRenderingContext2D, from: DrawPoint, to: DrawPoint, size: number) => {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const headLen = Math.max(size * 4, 14);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 6), to.y - headLen * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 6), to.y - headLen * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

const PhotoAnnotator = ({ imageSrc, onSubmit, onCancel }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#FF0000");
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<Tool>("draw");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const currentStroke = useRef<DrawPoint[]>([]);
  const arrowStart = useRef<DrawPoint | null>(null);
  const arrowEnd = useRef<DrawPoint | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [textInput, setTextInput] = useState<{ pos: DrawPoint; value: string } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<DrawPoint>({ x: 0, y: 0 });
  const isPinching = useRef(false);
  const lastPinchDist = useRef(0);
  const lastPinchCenter = useRef<DrawPoint>({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPanPoint = useRef<DrawPoint>({ x: 0, y: 0 });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const maxW = container.clientWidth;
      const maxH = 400;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      setCanvasReady(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const renderAnnotation = useCallback((ctx: CanvasRenderingContext2D, a: Annotation) => {
    if (a.type === "stroke") {
      if (a.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = a.color;
      ctx.lineWidth = a.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(a.points[0].x, a.points[0].y);
      for (let i = 1; i < a.points.length; i++) ctx.lineTo(a.points[i].x, a.points[i].y);
      ctx.stroke();
    } else if (a.type === "arrow") {
      ctx.beginPath();
      ctx.strokeStyle = a.color;
      ctx.lineWidth = a.size;
      ctx.lineCap = "round";
      ctx.moveTo(a.from.x, a.from.y);
      ctx.lineTo(a.to.x, a.to.y);
      ctx.stroke();
      drawArrowhead(ctx, a.from, a.to, a.size);
    } else if (a.type === "text") {
      const fs = a.fontSize;
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.fillStyle = a.color;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 3;
      ctx.strokeText(a.text, a.pos.x, a.pos.y);
      ctx.fillText(a.text, a.pos.x, a.pos.y);
    }
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const a of annotations) renderAnnotation(ctx, a);
  }, [annotations, renderAnnotation]);

  useEffect(() => {
    if (canvasReady) redraw();
  }, [canvasReady, redraw]);

  useEffect(() => {
    if (textInput && textInputRef.current) textInputRef.current.focus();
  }, [textInput]);

  // Clamp pan so canvas doesn't go off-screen
  const clampPan = useCallback((p: DrawPoint, z: number): DrawPoint => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return p;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const cw = canvas.width * z;
    const ch = canvas.height * z;
    const maxX = Math.max(0, (cw - vw) / 2);
    const maxY = Math.max(0, (ch - vh) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, p.x)),
      y: Math.max(-maxY, Math.min(maxY, p.y)),
    };
  }, []);

  // Convert screen coordinates to canvas coordinates (accounting for zoom + pan)
  const getPos = (e: React.TouchEvent | React.MouseEvent): DrawPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const getTouchDist = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const getTouchCenter = (touches: React.TouchList): DrawPoint => {
    if (touches.length < 2) return { x: touches[0].clientX, y: touches[0].clientY };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  // Touch handlers that distinguish pinch/pan from drawing
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length >= 2) {
      // Pinch or two-finger pan
      e.preventDefault();
      isPinching.current = true;
      lastPinchDist.current = getTouchDist(e.touches);
      lastPinchCenter.current = getTouchCenter(e.touches);
      // Cancel any in-progress drawing
      if (isDrawing) {
        setIsDrawing(false);
        currentStroke.current = [];
        arrowStart.current = null;
        arrowEnd.current = null;
      }
      return;
    }
    // Single finger: if zoomed in, allow pan with two-finger or just draw
    if (zoom > 1 && tool === "draw") {
      // Still allow drawing with single finger even when zoomed
    }
    startDraw(e);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length >= 2 && isPinching.current) {
      e.preventDefault();
      const newDist = getTouchDist(e.touches);
      const newCenter = getTouchCenter(e.touches);

      // Zoom
      if (lastPinchDist.current > 0) {
        const scaleFactor = newDist / lastPinchDist.current;
        setZoom(prev => {
          const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * scaleFactor));
          return next;
        });
      }

      // Pan
      const dx = newCenter.x - lastPinchCenter.current.x;
      const dy = newCenter.y - lastPinchCenter.current.y;
      setPan(prev => clampPan({ x: prev.x + dx, y: prev.y + dy }, zoom));

      lastPinchDist.current = newDist;
      lastPinchCenter.current = newCenter;
      return;
    }
    moveDraw(e);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      isPinching.current = false;
      lastPinchDist.current = 0;
    }
    if (e.touches.length === 0) {
      endDraw();
    }
  };

  // Mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * delta));
      // Re-clamp pan for new zoom
      setPan(p => clampPan(p, next));
      return next;
    });
  }, [clampPan]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.addEventListener("wheel", handleWheel, { passive: false });
    return () => vp.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Middle-mouse / right-click pan for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Pan mode
      e.preventDefault();
      isPanning.current = true;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      return;
    }
    startDraw(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      e.preventDefault();
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      setPan(prev => clampPan({ x: prev.x + dx, y: prev.y + dy }, zoom));
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      return;
    }
    moveDraw(e);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }
    endDraw();
  };

  // Drawing handlers (tool-based)
  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    if (tool === "text") {
      setTextInput({ pos, value: "" });
      return;
    }
    if (tool === "arrow") {
      arrowStart.current = pos;
      arrowEnd.current = pos;
      setIsDrawing(true);
      return;
    }
    setIsDrawing(true);
    currentStroke.current = [pos];
  };

  const moveDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e);
    if (!pos) return;

    if (tool === "arrow" && arrowStart.current) {
      arrowEnd.current = pos;
      redraw();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.moveTo(arrowStart.current.x, arrowStart.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      drawArrowhead(ctx, arrowStart.current, pos, brushSize);
      return;
    }

    currentStroke.current.push(pos);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || currentStroke.current.length < 2) return;
    const pts = currentStroke.current;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === "arrow" && arrowStart.current && arrowEnd.current) {
      const dist = Math.hypot(arrowEnd.current.x - arrowStart.current.x, arrowEnd.current.y - arrowStart.current.y);
      if (dist > 5) {
        setAnnotations(prev => [...prev, {
          type: "arrow",
          from: { ...arrowStart.current! },
          to: { ...arrowEnd.current! },
          color,
          size: brushSize,
        }]);
      }
      arrowStart.current = null;
      arrowEnd.current = null;
      return;
    }

    if (tool === "draw" && currentStroke.current.length > 0) {
      setAnnotations(prev => [...prev, { type: "stroke", points: [...currentStroke.current], color, size: brushSize }]);
    }
    currentStroke.current = [];
  };

  const commitText = () => {
    if (!textInput || !textInput.value.trim()) {
      setTextInput(null);
      return;
    }
    const fontSize = brushSize === 3 ? 16 : brushSize === 6 ? 22 : 30;
    setAnnotations(prev => [...prev, {
      type: "text",
      pos: textInput.pos,
      text: textInput.value.trim(),
      color,
      fontSize,
    }]);
    setTextInput(null);
  };

  const undo = () => {
    setAnnotations(prev => {
      const next = prev.slice(0, -1);
      setTimeout(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        const img = imgRef.current;
        if (!canvas || !ctx || !img) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        for (const a of next) renderAnnotation(ctx, a);
      }, 0);
      return next;
    });
  };

  const clearAll = () => {
    setAnnotations([]);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const zoomIn = () => {
    setZoom(prev => {
      const next = Math.min(MAX_ZOOM, prev * 1.3);
      setPan(p => clampPan(p, next));
      return next;
    });
  };

  const zoomOut = () => {
    setZoom(prev => {
      const next = Math.max(MIN_ZOOM, prev / 1.3);
      setPan(p => clampPan(p, next));
      return next;
    });
  };

  const handleSubmit = () => {
    redraw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSubmit(canvas.toDataURL("image/jpeg", 0.9));
  };

  const TOOLS: { id: Tool; icon: typeof Pencil; label: string }[] = [
    { id: "draw", icon: Pencil, label: "Draw" },
    { id: "arrow", icon: MoveRight, label: "Arrow" },
    { id: "text", icon: Type, label: "Text" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onCancel} className="text-sm text-muted-foreground">Cancel</button>
        <h2 className="text-sm font-bold" style={{ color: "#D4AF37" }}>ANNOTATE PHOTO</h2>
        <button
          onClick={handleSubmit}
          className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "#D4AF37", color: "#0D1B2A" }}
        >
          <Send size={14} /> Diagnose
        </button>
      </div>

      {/* Canvas viewport */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center px-4 py-3 relative"
      >
        <div
          ref={viewportRef}
          className="relative overflow-hidden rounded-xl"
          style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <canvas
            ref={canvasRef}
            className="rounded-xl"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              cursor: tool === "text" ? "text" : zoom > 1 ? "grab" : "crosshair",
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: "center center",
              touchAction: "none",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { isPanning.current = false; endDraw(); }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        </div>

        {/* Zoom controls overlay */}
        <div className="absolute top-2 right-6 flex flex-col gap-1" style={{ zIndex: 20 }}>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="flex items-center justify-center rounded-lg border border-border disabled:opacity-30 transition-colors"
            style={{ width: 32, height: 32, background: "rgba(13,27,42,0.85)" }}
          >
            <ZoomIn size={16} style={{ color: "#D4AF37" }} />
          </button>
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="flex items-center justify-center rounded-lg border border-border disabled:opacity-30 transition-colors"
            style={{ width: 32, height: 32, background: "rgba(13,27,42,0.85)" }}
          >
            <ZoomOut size={16} style={{ color: "#D4AF37" }} />
          </button>
          {zoom > 1 && (
            <button
              onClick={resetZoom}
              className="flex items-center justify-center rounded-lg border border-border transition-colors"
              style={{ width: 32, height: 32, background: "rgba(13,27,42,0.85)" }}
            >
              <Maximize size={14} style={{ color: "#D4AF37" }} />
            </button>
          )}
        </div>

        {/* Zoom level indicator */}
        {zoom > 1 && (
          <div
            className="absolute bottom-2 left-6 text-[10px] font-mono px-2 py-1 rounded"
            style={{ background: "rgba(13,27,42,0.85)", color: "#D4AF37", zIndex: 20 }}
          >
            {Math.round(zoom * 100)}%
          </div>
        )}

        {/* Text input overlay */}
        {textInput && canvasRef.current && (() => {
          const canvas = canvasRef.current!;
          const rect = canvas.getBoundingClientRect();
          const scaleX = rect.width / canvas.width;
          const scaleY = rect.height / canvas.height;
          const left = rect.left - (containerRef.current?.getBoundingClientRect().left || 0) + textInput.pos.x * scaleX;
          const top = rect.top - (containerRef.current?.getBoundingClientRect().top || 0) + textInput.pos.y * scaleY;
          return (
            <div className="absolute" style={{ left, top, zIndex: 30 }}>
              <input
                ref={textInputRef}
                value={textInput.value}
                onChange={e => setTextInput({ ...textInput, value: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setTextInput(null); }}
                onBlur={commitText}
                className="bg-black/70 text-white border rounded px-2 py-1 text-sm outline-none"
                style={{ borderColor: color, color, minWidth: 100 }}
                placeholder="Type label..."
              />
            </div>
          );
        })()}
      </div>

      {/* Toolbar */}
      <div className="px-4 py-3 border-t border-border space-y-3">
        {/* Tool selector */}
        <div className="flex items-center gap-1 justify-center">
          {TOOLS.map(t => {
            const Icon = t.icon;
            const active = tool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: active ? "rgba(212,175,55,0.2)" : "transparent",
                  border: active ? "1px solid #D4AF37" : "1px solid rgba(255,255,255,0.1)",
                  color: active ? "#D4AF37" : "rgba(255,255,255,0.5)",
                }}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Colors + sizes */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="rounded-full transition-all"
                style={{
                  width: color === c ? 28 : 22,
                  height: color === c ? 28 : 22,
                  background: c,
                  border: color === c ? "2px solid white" : "1px solid rgba(255,255,255,0.3)",
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Circle size={14} className="text-muted-foreground" />
            {BRUSH_SIZES.map(s => (
              <button
                key={s}
                onClick={() => setBrushSize(s)}
                className="rounded-full bg-foreground transition-all"
                style={{
                  width: s + 10,
                  height: s + 10,
                  opacity: brushSize === s ? 1 : 0.4,
                  border: brushSize === s ? "1px solid #D4AF37" : "none",
                }}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={annotations.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-muted-foreground border border-border disabled:opacity-30 transition-colors"
          >
            <Undo2 size={14} /> Undo
          </button>
          <button
            onClick={clearAll}
            disabled={annotations.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-muted-foreground border border-border disabled:opacity-30 transition-colors"
          >
            <Trash2 size={14} /> Clear
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          {tool === "draw" ? "Draw freehand to highlight areas" :
           tool === "arrow" ? "Drag to draw an arrow" :
           "Tap to add a text label"}
          {" · Pinch or scroll to zoom · Alt+drag to pan"}
        </p>
      </div>
    </div>
  );
};

export default PhotoAnnotator;
