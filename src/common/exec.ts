import ChildProcess from 'child_process';
import { Readable } from 'stream';

export async function exec(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const childProcess = ChildProcess.exec(command, (err, stdout) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(stdout);
    });
    childProcess.stdout?.pipe(process.stdout);
    childProcess.stderr?.pipe(process.stderr);
  });
}
