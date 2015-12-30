package surveyKPI;

/*
This file is part of SMAP.

SMAP is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

SMAP is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with SMAP.  If not, see <http://www.gnu.org/licenses/>.

*/

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Application;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import org.apache.commons.fileupload.FileItem;
import org.apache.commons.fileupload.FileUploadException;
import org.apache.commons.fileupload.disk.DiskFileItemFactory;
import org.apache.commons.fileupload.servlet.ServletFileUpload;
import org.apache.commons.io.FileUtils;
import org.smap.notifications.interfaces.EmitNotifications;
import org.smap.sdal.Utilities.Authorise;
import org.smap.sdal.Utilities.GeneralUtilityMethods;
import org.smap.sdal.Utilities.SDDataSource;
import org.smap.sdal.Utilities.UtilityMethodsEmail;
import org.smap.sdal.managers.OrganisationManager;
import org.smap.sdal.managers.ProjectManager;
import org.smap.sdal.managers.UserManager;
import org.smap.sdal.model.Organisation;
import org.smap.sdal.model.Project;
import org.smap.sdal.model.User;
import org.smap.sdal.model.UserGroup;

import surveyKPI.PasswordReset.PasswordDetails;
import model.MediaResponse;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Type;
import java.sql.*;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;

/*
 * Returns a list of all projects that are in the same organisation as the user making the request
 */
@Path("/register")
public class Register extends Application {

	private static Logger log =
			 Logger.getLogger(Register.class.getName());
	
	// Tell class loader about the root classes.  (needed as tomcat6 does not support servlet 3)
	public Set<Class<?>> getClasses() {
		Set<Class<?>> s = new HashSet<Class<?>>();
		s.add(Register.class);
		return s;
	}

	class RegistrationDetails {
		String email;
		String org_name;
		String admin_name;
		String website;
	}
	
	/*
	 * Register a new organisation
	 */
	@POST
	public Response register(
			@Context HttpServletRequest request,
			@FormParam("registrationDetails") String registrationDetails) { 
		
		Response response = null;
		
		GeneralUtilityMethods.assertSelfRegistrationServer(request.getServerName());
		
		RegistrationDetails rd = new Gson().fromJson(registrationDetails, RegistrationDetails.class);
		
		System.out.println("Registering a new user: " + rd.email);
		
	
		try {
		    Class.forName("org.postgresql.Driver");	 
		} catch (ClassNotFoundException e) {
			log.log(Level.SEVERE,"Error: Can't find PostgreSQL JDBC Driver", e);
			response = Response.serverError().build();
		    return response;
		}
		
		Connection sd = SDDataSource.getConnection("surveyKPI-OrganisationList");

		
		PreparedStatement pstmt = null;
		try {
			
			String requestUrl = request.getRequestURL().toString();
			String userIdent = request.getRemoteUser();
			String basePath = GeneralUtilityMethods.getBasePath(request);
			
			/*
			 * 1. Create organisation
			 */
			OrganisationManager om = new OrganisationManager();
			Organisation o = new Organisation();
			o.admin_email = rd.email;
			o.name = rd.org_name;
			o.company_name = rd.org_name;
			o.website = rd.website;
			
			sd.setAutoCommit(false);
			int o_id = om.createOrganisation(
					sd, 
					o, 
					userIdent, 
					null,
					requestUrl,
					basePath,
					null,
					rd.email);
			
			/*
			 * 2. Create the user
			 */
			UserManager um = new UserManager();
			
			User u = new User();
			u.name = rd.admin_name;
			u.company_name = rd.org_name;
			u.email = rd.email;
			u.ident = rd.email;
			u.sendEmail = true;
			u.projects = new ArrayList<Project> ();	// Empty list initially as no projects exist yet
			
			// Add first three groups as default for an adminstrator
			u.groups = new ArrayList<UserGroup> ();
			for(int i = 1; i <=3; i++) {
				u.groups.add(new UserGroup(i, "group"));
			}
			
			int u_id = um.createUser(sd, u, o_id,
					false,
					request.getRemoteUser(),
					request.getServerName(),
					rd.admin_name);			 
			
			/*
			 * 3. Create a default project
			 */
			ProjectManager pm = new ProjectManager();
			Project p = new Project();
			p.name = "default";
			p.desc = "Default Project - Created on registration";
			pm.createProject(sd, p, o_id, u_id, request.getRemoteUser());
			
			/*
			 * 4. Create a notification recording this event
			 */
			try {
				EmitNotifications en = new EmitNotifications();
				en.publish(EmitNotifications.AWS_REGISTER_ORGANISATION,
						getRegistrationMsg(rd, request.getServerName()),
						"Register new organisation");
			} catch (Exception e) {
				// Don't fail on this step
			}
			
			sd.commit();
			sd.setAutoCommit(true);
			response = Response.ok().build();
		
				
		} catch (SQLException e) {
			try{sd.rollback();} catch(Exception ex) {}
			try{sd.setAutoCommit(true);} catch(Exception ex) {}
			
			String state = e.getSQLState();
			log.info("Register: sql state:" + state);
			if(state.startsWith("23")) {
				response = Response.status(Status.CONFLICT).entity(e.getMessage()).build();
			} else {
				response = Response.serverError().entity(e.getMessage()).build();
				log.log(Level.SEVERE,"Error", e);
			}
		} catch(Exception e) {
			try{sd.rollback();} catch(Exception ex) {}
			try{sd.setAutoCommit(true);} catch(Exception ex) {}
			response = Response.serverError().entity(e.getMessage()).build();
			log.log(Level.SEVERE,"Error", e);
		} finally {
			
			try {
				if (pstmt != null) {
					pstmt.close();
				}
			} catch (SQLException e) {
			}
			
			try {
				if (sd != null) {
					sd.close();
					sd = null;
				}
			} catch (SQLException e) {
				log.log(Level.SEVERE,"Failed to close connection", e);
			}
		}
		
		return response;
	}
	
	/*
	 * COnvert registation details into a text string suitable for email
	 */
	private String getRegistrationMsg(RegistrationDetails rd, String server) {
		
		StringBuffer msg = new StringBuffer();
		
		msg.append("Name: " + rd.admin_name + "\n");
		msg.append("Email: " + rd.email + "\n");
		msg.append("Organisation: " + rd.org_name + "\n");
		if(rd.website != null) {
			msg.append("Website: " + rd.website + "\n");
		}
		msg.append("Server: " + server);

		return msg.toString();
	}
	


}
