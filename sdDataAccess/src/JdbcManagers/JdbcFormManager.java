/*****************************************************************************

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

 ******************************************************************************/

package JdbcManagers;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import org.smap.server.entities.Form;
import org.smap.server.entities.Option;

public class JdbcFormManager {

	PreparedStatement pstmt = null;
	String sql = "insert into form ("
			+ "f_id, "
			+ "s_id, "
			+ "name, "
			+ "table_name, "
			+ "parentform, "
			+ "parentquestion, "
			+ "repeats, "
			+ "path) "
			+ "values (nextval('f_seq'), ?, ?, ?, ?, ?, ?, ?);";
	
	PreparedStatement pstmtUpdate = null;
	String sqlUpdate = "update form set "
			+ "parentform = ?,"
			+ "parentquestion = ?,"
			+ "repeats = ? "
			+ "where f_id = ?;";
	
	public JdbcFormManager(Connection sd) throws SQLException {
		pstmt = sd.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
		pstmtUpdate = sd.prepareStatement(sqlUpdate);
	}
	
	public void write(Form f) throws SQLException {
		pstmt.setInt(1, f.getSurveyId());
		pstmt.setString(2, f.getName());
		pstmt.setString(3, f.getTableName());
		pstmt.setInt(4, f.getParentForm());
		pstmt.setInt(5, f.getParentQuestionId());
		pstmt.setString(6, f.getRepeats());
		pstmt.setString(7, f.getPath());
		pstmt.executeUpdate();
		
		ResultSet rs = pstmt.getGeneratedKeys();
		if(rs.next()) {
			f.setId(rs.getInt(1));
		}
	}
	
	public void update(Form f) throws SQLException {
		pstmtUpdate.setInt(1, f.getParentForm());
		pstmtUpdate.setInt(2, f.getParentQuestionId());
		pstmtUpdate.setString(3, f.getRepeats());
		pstmtUpdate.setInt(4, f.getId());
		pstmtUpdate.executeUpdate();
	}
	
	public void close() {
		try {if(pstmt != null) {pstmt.close();}} catch(Exception e) {};
		try {if(pstmtUpdate != null) {pstmtUpdate.close();}} catch(Exception e) {};
	}
}
