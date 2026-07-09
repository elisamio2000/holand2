export type AnnotationAction = 
  | { type: 'path'; points: number[][]; color: string; width: number }
  | { type: 'arrow'; start: { x: number; y: number }; end: { x: number; y: number }; color: string; width: number }
  | { type: 'rect'; x: number; y: number; w: number; h: number; color: string; width: number; filled: boolean }
  | { type: 'text'; x: number; y: number; text: string; color: string; fontSize: number };

export class AnnotationHistory {
  private history: AnnotationAction[] = [];
  private pointer = -1;

  add(action: AnnotationAction): void {
    this.history = this.history.slice(0, this.pointer + 1);
    this.history.push(action);
    this.pointer++;
  }

  undo(): AnnotationAction[] | null {
    if (!this.canUndo()) return null;
    this.pointer--;
    return this.getCurrentState();
  }

  redo(): AnnotationAction[] | null {
    if (!this.canRedo()) return null;
    this.pointer++;
    return this.getCurrentState();
  }

  getCurrentState(): AnnotationAction[] {
    return this.history.slice(0, this.pointer + 1);
  }

  canUndo(): boolean {
    return this.pointer >= 0;
  }

  canRedo(): boolean {
    return this.pointer < this.history.length - 1;
  }

  clear(): void {
    this.history = [];
    this.pointer = -1;
  }

  getActionCount(): number {
    return this.pointer + 1;
  }
}
