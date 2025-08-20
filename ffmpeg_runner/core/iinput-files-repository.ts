export interface IInputFilesRepository {
  add(inputFile: string): { id: number; inputFile: string } | null;
  remove(inputFile: string): void;
  exists(inputFile: string): boolean;
}
