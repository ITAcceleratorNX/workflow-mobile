import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { MeetingRoomBooking, RequestGroup, SubRequest } from '@/lib/api';
import { persistStorage } from '@/lib/storage';

export interface GuestDemoBooking
  extends Pick<
    MeetingRoomBooking,
    'id' | 'meeting_room_id' | 'start_time' | 'end_time' | 'status' | 'company_name' | 'meetingRoom'
  > {}

export interface GuestDemoRequest
  extends Pick<
    RequestGroup,
    'id' | 'office_id' | 'location' | 'location_detail' | 'status' | 'created_date' | 'requests'
  > {
  is_demo?: boolean;
}

interface GuestDemoState {
  bookings: GuestDemoBooking[];
  requests: GuestDemoRequest[];
  addBooking: (booking: Omit<GuestDemoBooking, 'id'>) => number;
  removeBooking: (id: number) => void;
  clearBookings: () => void;
  addRequest: (request: Omit<GuestDemoRequest, 'id' | 'created_date'>) => number;
  clearRequests: () => void;
}

let nextGuestId = -1;

export const useGuestDemoStore = create<GuestDemoState>()(
  persist(
    (set, get) => ({
      bookings: [],
      requests: [],

      addBooking: (booking) => {
        const id = nextGuestId--;
        const newBooking: GuestDemoBooking = { ...booking, id };
        set((state) => ({
          bookings: [...state.bookings, newBooking].sort(
            (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          ),
        }));
        return id;
      },

      removeBooking: (id) =>
        set((state) => ({
          bookings: state.bookings.filter((b) => b.id !== id),
        })),

      clearBookings: () => set({ bookings: [] }),

      addRequest: (request) => {
        const id = nextGuestId--;
        const created_date = new Date().toISOString();
        const newRequest: GuestDemoRequest = {
          ...request,
          id,
          created_date,
          is_demo: true,
        };
        set((state) => ({
          requests: [newRequest, ...state.requests],
        }));
        return id;
      },

      clearRequests: () => set({ requests: [] }),
    }),
    {
      name: 'guest-demo-storage',
      storage: createJSONStorage(() => persistStorage),
    }
  )
);

