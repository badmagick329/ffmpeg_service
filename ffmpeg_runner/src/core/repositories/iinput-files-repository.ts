export interface IInputFilesRepository {
  add(inputFile: string): { id: number; inputFile: string } | null;
  remove(inputFile: string): { id: number; inputFile: string } | null;
  exists(inputFile: string): boolean;
}
