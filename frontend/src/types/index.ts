export interface User {
  id: string;
  email: string;
  name: string;
  gender?: string;
  birthDate?: string;
  height?: number;
  weight?: number;
}

export interface ScoreComponent {
  id: number;
  name: string;
  score: number;
  maxScore: number;
  category: string;
}

export interface DailyScore {
  date: string;
  totalScore: number;
  components: {
    weight: number;
    activity: number;
    plantFoods: number;
    fastFoods: number;
    meat: number;
    drinks: number;
    alcohol: number;
  };
}
