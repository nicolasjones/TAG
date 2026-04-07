import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();

export interface Schedule {
  id?: string;
  workflowName: string;
  cronExpression?: string;
  intervalMinutes?: number;
  payload?: any;
  isActive: boolean;
  lastRun?: admin.firestore.Timestamp;
  nextRun?: admin.firestore.Timestamp;
}

export class DatabaseService {
  private collection = db.collection('schedules');

  async getActiveSchedules(): Promise<Schedule[]> {
    const snapshot = await this.collection.where('isActive', '==', true).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule));
  }

  async updateSchedule(id: string, data: Partial<Schedule>) {
    await this.collection.doc(id).update(data);
  }

  async addSchedule(data: Schedule) {
    return await this.collection.add(data);
  }

  async removeSchedule(id: string) {
    await this.collection.doc(id).delete();
  }
}
