export interface IInputFilesRepository {
  add(filepath: string): { id: number; filepath: string } | null;
  remove(filepath: string): void;
  exists(filepath: string): boolean;
}
