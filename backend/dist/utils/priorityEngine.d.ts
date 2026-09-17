import { IApplication } from '../models/Application';
import { IResourceRequest } from '../models/ResourceRequest';
import { IOpportunity } from '../models/Opportunity';
import { IResourceListing } from '../models/Resource';
import { IUser } from '../models/User';
export interface PriorityDetails {
    priorityScore: number;
    priorityReasons: string[];
    isWaitlisted: boolean;
}
export declare const applicationPriority: (application: IApplication, opportunity: IOpportunity, student: IUser | undefined, existingBenefits: number, firstAt: Date, lastAt: Date, acceptedCount: number) => PriorityDetails;
export declare const resourceRequestPriority: (request: IResourceRequest, resource: IResourceListing | undefined, student: IUser | undefined, existingBenefits: number, firstAt: Date, lastAt: Date, acceptedCount: number) => PriorityDetails;
